import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import type { Citation } from '../lib/types'
import { passageHref, splitAnswer } from './answerModel'

interface AnswerTextProps {
  text: string
  /** Omitted for stored answers, whose citation targets are not loaded; markers then render as plain text. */
  citations?: Citation[]
  activeOrdinal?: number | null
  onMarkerFocus?: (ordinal: number | null) => void
  className?: string
}

/** The answer as the model wrote it, with its [n] markers turned into links. */
export function AnswerText({ text, citations, activeOrdinal, onMarkerFocus, className = '' }: AnswerTextProps) {
  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {splitAnswer(text).map((segment, index) => {
        if (segment.kind === 'text') return <Fragment key={index}>{segment.value}</Fragment>
        const citation = citations?.find((c) => c.ordinal === segment.ordinal)
        if (!citation) {
          return (
            <sup key={index} className="ml-0.5 font-mono text-[11px] text-ink-3">
              [{segment.ordinal}]
            </sup>
          )
        }
        return (
          <CitationMarker
            key={index}
            citation={citation}
            active={activeOrdinal === segment.ordinal}
            onFocus={onMarkerFocus}
          />
        )
      })}
    </p>
  )
}

interface CitationMarkerProps {
  citation: Citation
  active: boolean
  onFocus?: (ordinal: number | null) => void
}

function CitationMarker({ citation, active, onFocus }: CitationMarkerProps) {
  return (
    <Link
      to={passageHref(citation)}
      aria-label={`Source ${citation.ordinal}: open ${citation.file_name} at the cited passage`}
      title={`${citation.file_name} · chars ${citation.char_start}–${citation.char_end}`}
      onMouseEnter={() => onFocus?.(citation.ordinal)}
      onMouseLeave={() => onFocus?.(null)}
      onFocus={() => onFocus?.(citation.ordinal)}
      onBlur={() => onFocus?.(null)}
      className={`ml-0.5 inline-flex rounded-[3px] px-0.5 align-super font-mono text-[11px] font-medium text-cobalt underline decoration-cobalt/40 underline-offset-2 transition-colors hover:bg-cobalt-wash hover:decoration-cobalt focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cobalt ${
        active ? 'bg-cobalt-wash' : ''
      }`}
    >
      [{citation.ordinal}]
    </Link>
  )
}
