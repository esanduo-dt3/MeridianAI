-- =============================================================================
-- Ingestion and retrieval (docs/decisions.md D-022 to D-026)
--
-- Documents keep their extracted text, and every chunk's char_start/char_end
-- index into it, so a citation can highlight the exact passage. Search runs
-- through two functions executed as the caller, so row-level security scopes
-- every query to the caller's workspaces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Documents
-- -----------------------------------------------------------------------------
alter table public.documents
  add column doc_type      text check (doc_type in ('pdf', 'docx')),
  -- The canonical extracted text. chunks.char_start/char_end are offsets into it.
  add column content_text  text,
  add column page_count    integer check (page_count >= 0),
  add column chunk_count   integer not null default 0 check (chunk_count >= 0),
  add column parse_stats   jsonb not null default '{}'::jsonb,
  add column content_hash  text,
  add column processed_at  timestamptz;

-- The same file uploaded twice to one workspace is a duplicate, not a new source.
create unique index documents_workspace_hash_idx
  on public.documents (workspace_id, content_hash)
  where content_hash is not null;

-- -----------------------------------------------------------------------------
-- Chunks
-- -----------------------------------------------------------------------------
alter table public.chunks
  add column kind         text not null default 'text' check (kind in ('text', 'table', 'code')),
  add column section      text not null default '',
  add column page         integer check (page >= 1),
  add column token_count  integer not null default 0 check (token_count >= 0),
  -- Retrieval aid prepended when embedding and when shown to the model: the
  -- heading path, plus a table's header row for a continuation of a split table.
  -- Never part of the cited passage, which is always content_text[char_start:char_end].
  add column context      text not null default '';

-- Keyword search covers the section path and context as well as the passage.
drop index if exists public.chunks_tsv_idx;
alter table public.chunks drop column content_tsv;
alter table public.chunks
  add column search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(context, '')), 'B')
    || setweight(to_tsvector('english', content), 'A')
  ) stored;
create index chunks_search_idx on public.chunks using gin (search_tsv);

-- Embeddings are removed with their document, and ingestion can clean up a
-- half-written document by id.
alter table public.chunk_embeddings
  add column document_id uuid references public.documents (id) on delete cascade;
create index chunk_embeddings_document_idx on public.chunk_embeddings (document_id);

-- -----------------------------------------------------------------------------
-- Answers and runs
-- -----------------------------------------------------------------------------
alter table public.agent_answers
  add column flagged            boolean not null default false,
  add column flag_reasons       text[] not null default '{}',
  add column general_knowledge  boolean not null default false;
create index agent_answers_flagged_idx on public.agent_answers (workspace_id, created_at desc) where flagged;

alter table public.retrieval_runs
  add column final_query  text,
  add column profile      text not null default 'lookup',
  add column top_score    double precision;

-- -----------------------------------------------------------------------------
-- Search functions. The workspace is the namespace: every chunk and embedding
-- carries workspace_id, both legs filter on it before ranking, and an optional
-- document list narrows the search further (D-025). SECURITY INVOKER (the
-- default), so row-level security on chunks and chunk_embeddings also applies.
-- -----------------------------------------------------------------------------
create index chunks_workspace_document_idx on public.chunks (workspace_id, document_id);

-- Dense leg: cosine similarity over the HNSW index. Iterative scanning keeps
-- returning candidates when the workspace filter discards nearby neighbours.
-- Volatile because it sets transaction-local index parameters.
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
    where e.workspace_id = p_workspace_id
      and (p_document_ids is null or e.document_id = any (p_document_ids))
    order by e.embedding <=> p_query_embedding
    limit least(greatest(p_match_count, 1), 100);
end;
$$;

-- Lexical leg: any query term may match (OR), ranked by cover density so
-- passages holding several terms close together rank first.
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
    where c.workspace_id = p_workspace_id
      and (p_document_ids is null or c.document_id = any (p_document_ids))
      and c.search_tsv @@ tsq
    order by 2 desc
    limit least(greatest(p_match_count, 1), 100);
end;
$$;

revoke all on function public.match_chunks_dense(uuid, extensions.vector, integer, uuid[]) from public, anon;
revoke all on function public.match_chunks_sparse(uuid, text, integer, uuid[]) from public, anon;
grant execute on function public.match_chunks_dense(uuid, extensions.vector, integer, uuid[]) to authenticated, service_role;
grant execute on function public.match_chunks_sparse(uuid, text, integer, uuid[]) to authenticated, service_role;
