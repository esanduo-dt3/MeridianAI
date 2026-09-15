import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Circle, CircleNotch, Code, Rows, Table, WarningCircle } from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { ProgressBar } from '../documents/IngestProgress'
import { embeddingFraction } from '../documents/ingestState'
import { useDocument } from '../documents/useDocuments'
import { codepointText } from '../lib/codepoints'
import { errorText } from '../lib/queryClient'
import type { ChunkInfo } from '../lib/types'
import { formatBytes } from '../lib/format'

const KIND_ICON = { text: Rows, table: Table, code: Code } as const

/**
 * The extracted text of a document with its passages. Opening
 * /documents/:id?chunk=<id> (or ?start=&end=) highlights that exact span, which is
 * how a citation links to the passage the model read.
 *
 * Passages are shown as soon as they are saved, while embedding is still running,
 * with each passage marked until its embedding is stored (D-034).
 */
export function DocumentViewer() {
  const { documentId } = useParams()
  const [params, setParams] = useSearchParams()
  const doc = useDocument(documentId)
  const markRef = useRef<HTMLElement>(null)

  const selected: ChunkInfo | undefined = doc.data?.chunks.find((c) => c.id === params.get('chunk'))
  const start = selected?.char_start ?? (params.has('start') ? Number(params.get('start')) : null)
  const end = selected?.char_end ?? (params.has('end') ? Number(params.get('end')) : null)
  const text = useMemo(() => codepointText(doc.data?.content_text ?? ''), [doc.data?.content_text])
  const hasSpan = start !== null && end !== null && Number.isFinite(start) && Number.isFinite(end) && end > start && end <= text.length

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [start, end, doc.data?.id])

  if (doc.isPending) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading document">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (doc.isError) {
    return <ErrorState title="This document couldn't be loaded" message={errorText(doc.error)} onRetry={() => void doc.refetch()} />
  }
  const data = doc.data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/documents" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft aria-hidden size={14} weight="bold" />
          Documents
        </Link>
        <h1 className="mt-2 font-display text-[26px] leading-tight font-semibold tracking-[-0.03em] break-words text-ink sm:text-[30px]">
          {data.file_name}
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {[
            data.doc_type?.toUpperCase(),
            formatBytes(data.size_bytes),
            data.page_count ? `${data.page_count} pages` : null,
            `${data.chunk_count} passages`,
            data.parse_stats.tables ? `${data.parse_stats.tables} ${data.parse_stats.tables === 1 ? "table" : "tables"}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {data.parsed_status === 'processing' && data.processing_stage === 'embedding' && (
        <div role="status" className="rounded-(--radius-panel) border border-rule bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <CircleNotch aria-hidden size={15} weight="bold" className="animate-spin text-cobalt" />
              Embedding passages
            </span>
            <span className="font-mono text-xs text-ink-3 tabular">
              {data.embedded_count} of {data.chunk_count}
            </span>
          </div>
          <ProgressBar value={embeddingFraction(data)} label="Embedding progress" className="mt-3" />
          <p className="mt-2.5 text-sm text-ink-3">
            You can read the passages now. The document becomes searchable when every passage is embedded.
          </p>
        </div>
      )}
      {data.parsed_status === 'failed' && data.chunks.length > 0 && (
        <div role="alert" className="flex items-start gap-2.5 rounded-(--radius-panel) border border-danger/30 bg-danger-wash px-5 py-4 text-sm text-danger">
          <WarningCircle aria-hidden size={18} weight="fill" className="mt-px shrink-0" />
          <span>
            {data.parse_error ?? 'Processing failed.'} These passages were saved before it stopped. The document is not searchable until it
            is reprocessed.
          </span>
        </div>
      )}

      {!data.content_text || data.chunks.length === 0 ? (
        <EmptyState icon={Rows} title={data.parsed_status === 'failed' ? 'This document failed to process' : 'Reading the file'}>
          {data.parse_error ?? 'Passages appear here as soon as the file is split into passages. This page updates automatically.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Passages" className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
            <ol className="flex flex-col gap-1">
              {data.chunks.map((chunk) => {
                const Icon = KIND_ICON[chunk.kind]
                const active = chunk.id === selected?.id
                const preview = text.slice(chunk.char_start, Math.min(chunk.char_end, chunk.char_start + 140)).replace(/\s+/g, ' ').trim()
                return (
                  <li key={chunk.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setParams({ chunk: chunk.id }, { replace: true })}
                      className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-(--radius-control) border px-3 py-2 text-left transition-colors ${
                        active ? 'border-cobalt bg-cobalt-wash' : 'border-transparent hover:bg-sunken'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <Icon aria-hidden size={14} weight="bold" className="text-ink-3" />
                        Passage {chunk.chunk_index + 1}
                        {chunk.page && <span className="font-normal text-ink-3">· p.{chunk.page}</span>}
                        {data.parsed_status !== 'ready' && <EmbeddedMark embedded={chunk.embedded} />}
                      </span>
                      {chunk.section && <span className="truncate text-xs text-ink-3">{chunk.section}</span>}
                      <span className="line-clamp-2 text-xs leading-snug text-ink-2">{preview}</span>
                      <span className="font-mono text-[11px] text-ink-3 tabular">
                        chars {chunk.char_start}–{chunk.char_end} · ~{chunk.token_count} tokens
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <article
            aria-label="Extracted text"
            className="min-w-0 rounded-(--radius-panel) border border-rule bg-surface p-5 font-sans text-[14.5px] leading-[1.75] whitespace-pre-wrap text-ink-2 sm:p-7"
          >
            {hasSpan ? (
              <>
                {text.slice(0, start!)}
                <mark ref={markRef} className="rounded-[3px] bg-mark px-0.5 text-ink [box-decoration-break:clone]">
                  {text.slice(start!, end!)}
                </mark>
                {text.slice(end!)}
              </>
            ) : (
              data.content_text
            )}
          </article>
        </div>
      )}
    </div>
  )
}

function EmbeddedMark({ embedded }: { embedded: boolean }) {
  return embedded ? (
    <span className="ml-auto text-grounded" title="Embedded">
      <CheckCircle aria-label="Embedded" size={14} weight="fill" />
    </span>
  ) : (
    <span className="ml-auto text-ink-3" title="Not embedded yet">
      <Circle aria-label="Not embedded yet" size={14} weight="bold" />
    </span>
  )
}
