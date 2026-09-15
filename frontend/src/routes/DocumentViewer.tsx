import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Rows, Table, Code } from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
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

      {data.parsed_status !== 'ready' || !data.content_text ? (
        <EmptyState icon={Rows} title={data.parsed_status === 'failed' ? 'This document failed to process' : 'Still processing'}>
          {data.parse_error ?? 'Passages appear here once processing finishes. This page updates automatically.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav aria-label="Passages" className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
            <ol className="flex flex-col gap-1">
              {data.chunks.map((chunk) => {
                const Icon = KIND_ICON[chunk.kind]
                const active = chunk.id === selected?.id
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
                      </span>
                      {chunk.section && <span className="truncate text-xs text-ink-3">{chunk.section}</span>}
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
