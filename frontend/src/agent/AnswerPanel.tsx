import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Info } from '@phosphor-icons/react'
import { ReliabilityNote } from '../components/ReliabilityNote'
import type { AskResponse, Citation } from '../lib/types'
import { ConfidenceReadout, FlagReasons, FlaggedBadge, GroundednessBadge } from './AnswerSignals'
import { AnswerText } from './AnswerText'
import { passageHref } from './answerModel'

/*
  One answer, with everything needed to check it: the text with linked citation
  markers, the passages behind them, the uncalibrated confidence, the
  groundedness result, and the retrieval run that produced it.
*/
// PUBLIC_INTERFACE
export function AnswerPanel({ result }: { result: AskResponse }) {
  const [active, setActive] = useState<number | null>(null)

  return (
    <section aria-label="Answer" className="flex flex-col gap-5">
      <div className="rounded-(--radius-panel) border border-rule bg-surface p-5 shadow-(--shadow-panel) sm:p-7">
        <p className="text-sm text-ink-3">{result.question}</p>

        <AnswerText
          text={result.answer}
          citations={result.citations}
          activeOrdinal={active}
          onMarkerFocus={setActive}
          className="mt-3 text-[16px] leading-[1.75] text-ink"
        />

        {!result.answerable && (
          <p className="mt-4 flex gap-2 rounded-(--radius-control) bg-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
            <Info aria-hidden size={15} weight="bold" className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              Meridian refuses rather than guesses when the workspace has no passage that supports an answer. Upload the
              document that covers this, or ask something the workspace already holds.
            </span>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-4">
          <ConfidenceReadout confidence={result.confidence} />
          <GroundednessBadge grounded={result.grounded} />
          {result.flagged && <FlaggedBadge />}
        </div>
      </div>

      {result.flagged && <FlagReasons reasons={result.flag_reasons} />}

      {result.citations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] tracking-wide text-ink-3 uppercase">
            {result.citations.length === 1 ? '1 cited passage' : `${result.citations.length} cited passages`}
          </h2>
          <ol className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {result.citations.map((citation) => (
              <CitationCard
                key={`${citation.ordinal}-${citation.chunk_id}`}
                citation={citation}
                active={active === citation.ordinal}
                onFocus={setActive}
              />
            ))}
          </ol>
        </div>
      )}

      <RetrievalDetail result={result} />
      <ReliabilityNote compact />
    </section>
  )
}

interface CitationCardProps {
  citation: Citation
  active: boolean
  onFocus: (ordinal: number | null) => void
}

function CitationCard({ citation, active, onFocus }: CitationCardProps) {
  const location = [citation.page ? `p.${citation.page}` : null, citation.section || null].filter(Boolean).join(' · ')

  return (
    <li>
      <Link
        to={passageHref(citation)}
        onMouseEnter={() => onFocus(citation.ordinal)}
        onMouseLeave={() => onFocus(null)}
        onFocus={() => onFocus(citation.ordinal)}
        onBlur={() => onFocus(null)}
        className={`group flex flex-col gap-1.5 rounded-(--radius-panel) border bg-surface px-4 py-3.5 transition-colors ${
          active ? 'border-cobalt' : 'border-rule hover:border-rule-strong'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-medium text-cobalt">[{citation.ordinal}]</span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium break-words text-ink">
            <FileText aria-hidden size={14} weight="bold" className="shrink-0 text-ink-3" />
            {citation.file_name}
          </span>
          {location && <span className="text-xs text-ink-3">{location}</span>}
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-ink-3 tabular">
            chars {citation.char_start}–{citation.char_end}
            <ArrowUpRight
              aria-hidden
              size={12}
              weight="bold"
              className="text-ink-3 transition-colors group-hover:text-cobalt"
            />
          </span>
        </div>
        <p className="line-clamp-3 text-[13.5px] leading-[1.7] text-ink-2">{citation.excerpt}</p>
      </Link>
    </li>
  )
}

/*
  How the answer was produced. Every figure is read off the recorded retrieval
  run, including which model actually answered: on the free tier the gateway
  falls back across models, and that changes answer quality (D-032).
*/
function RetrievalDetail({ result }: { result: AskResponse }) {
  const rows: Array<[string, string]> = [
    ['Model', result.model],
    ['Attempts', String(result.retrieval.attempts)],
    ['Retrieval grade', result.retrieval.grade],
    ['Top rerank score', result.retrieval.top_score === null ? '—' : result.retrieval.top_score.toFixed(3)],
    ['Reranked', result.retrieval.reranked ? 'yes' : 'no'],
    ['Latency', `${(result.retrieval.latency_ms / 1000).toFixed(1)}s`],
  ]

  return (
    <details className="rounded-(--radius-panel) border border-rule bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        How this answer was retrieved
      </summary>
      <div className="border-t border-rule px-4 py-3.5">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-3">{label}</dt>
              <dd className="font-mono break-words text-ink-2 tabular">{value}</dd>
            </div>
          ))}
        </dl>
        {result.retrieval.final_query !== result.question && (
          <p className="mt-3 border-t border-rule pt-3 text-[13px] leading-relaxed text-ink-2">
            The first search found little, so the question was rewritten to{' '}
            <span className="text-ink">“{result.retrieval.final_query}”</span> and run again.
          </p>
        )}
        <p className="mt-3 font-mono text-[11px] break-all text-ink-3">run {result.retrieval.run_id}</p>
      </div>
    </details>
  )
}
