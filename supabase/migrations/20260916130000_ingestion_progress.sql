-- Ingestion progress (docs/decisions.md D-034).
--
-- Passages are saved as soon as a document is chunked, so they can be previewed
-- while embedding runs, and embedding progress is recorded batch by batch.
-- Search returns passages only from documents that finished processing, so a
-- half-embedded document is never partly searchable.

alter table public.documents
  add column processing_stage text check (processing_stage in ('parsing', 'embedding')),
  add column embedded_count   integer not null default 0 check (embedded_count >= 0);

update public.documents d
   set embedded_count = (
     select count(*) from public.chunks c where c.document_id = d.id and c.embedding_ref is not null
   );

-- Links a batch of chunks to their stored embeddings and refreshes the
-- document's embedded_count. p_pairs: [{"chunk_id": uuid, "embedding_id": uuid}].
create or replace function public.attach_chunk_embeddings(p_document_id uuid, p_pairs jsonb)
returns integer
language plpgsql volatile
set search_path = public, pg_catalog
as $$
declare
  embedded integer;
begin
  update public.chunks c
     set embedding_ref = (p ->> 'embedding_id')::uuid
    from jsonb_array_elements(p_pairs) p
   where c.document_id = p_document_id
     and c.id = (p ->> 'chunk_id')::uuid;

  select count(*) into embedded
    from public.chunks
   where document_id = p_document_id and embedding_ref is not null;

  update public.documents set embedded_count = embedded where id = p_document_id;
  return embedded;
end;
$$;

revoke all on function public.attach_chunk_embeddings(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.attach_chunk_embeddings(uuid, jsonb) to service_role;

create or replace function public.match_chunks_dense(
  p_workspace_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 20,
  p_document_ids uuid[] default null
)
returns table (chunk_id uuid, similarity double precision)
language plpgsql volatile
set search_path = public, extensions, pg_catalog
as $$
begin
  -- Supabase does not allow these in the function's SET clause, so they are set
  -- for the current transaction instead.
  perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  perform set_config('hnsw.ef_search', '100', true);
  return query
    select c.id, (1 - (e.embedding <=> p_query_embedding))::double precision
    from public.chunk_embeddings e
    join public.chunks c on c.embedding_ref = e.id
    join public.documents d on d.id = c.document_id
    where e.workspace_id = p_workspace_id
      and d.parsed_status = 'ready'
      and (p_document_ids is null or e.document_id = any (p_document_ids))
    order by e.embedding <=> p_query_embedding
    limit least(greatest(p_match_count, 1), 100);
end;
$$;

create or replace function public.match_chunks_sparse(
  p_workspace_id uuid,
  p_query text,
  p_match_count integer default 20,
  p_document_ids uuid[] default null
)
returns table (chunk_id uuid, rank real)
language plpgsql stable
set search_path = public, pg_catalog
as $$
declare
  tsq tsquery;
begin
  tsq := nullif(replace(plainto_tsquery('english', p_query)::text, '&', '|'), '')::tsquery;
  if tsq is null then
    return;
  end if;
  return query
    select c.id, ts_rank_cd(c.search_tsv, tsq, 32)
    from public.chunks c
    join public.documents d on d.id = c.document_id
    where c.workspace_id = p_workspace_id
      and d.parsed_status = 'ready'
      and (p_document_ids is null or c.document_id = any (p_document_ids))
      and c.search_tsv @@ tsq
    order by 2 desc
    limit least(greatest(p_match_count, 1), 100);
end;
$$;
