import { Flag, SealCheck, SealWarning } from '@phosphor-icons/react'
import { ConfidenceLabel } from '../components/ConfidenceLabel'
import type { Confidence } from '../lib/types'
import { flagReasonText } from './answerModel'

/*
  The three signals the PRD requires next to every answer: an uncalibrated
  confidence value, the groundedness-check result, and the reasons an answer was
  flagged for review. Shared by the live answer and the recent-answers list so
  both read the same way.
*/

export function ConfidenceReadout({ confidence }: { confidence: Confidence }) {
  if (confidence.value === null) {
    return (
      <span className="font-mono text-xs text-ink-3" title={confidence.basis}>
        confidence not available
      </span>
    )
  }
  return <ConfidenceLabel value={confidence.value} />
}

export function GroundednessBadge({ grounded }: { grounded: boolean }) {
  const Icon = grounded ? SealCheck : SealWarning
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        grounded ? 'bg-grounded-wash text-grounded' : 'bg-flag-wash text-flag'
      }`}
      title={
        grounded
          ? 'A second model checked each sentence against the cited passages and found them supported.'
          : 'A second model checked each sentence against the cited passages and found at least one unsupported.'
      }
    >
      <Icon aria-hidden size={14} weight="fill" />
      {grounded ? 'Grounded' : 'Not grounded'}
    </span>
  )
}

export function FlaggedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-flag-wash px-2.5 py-0.5 text-xs font-medium text-flag"
      title="This answer is in the admin review queue."
    >
      <Flag aria-hidden size={14} weight="fill" />
      Flagged for review
    </span>
  )
}

export function FlagReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null
  return (
    <div className="rounded-(--radius-panel) border border-flag/30 bg-flag-wash px-4 py-3">
      <p className="text-[13px] font-medium text-flag">Why this went to review</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-flag" />
            {flagReasonText(reason)}
          </li>
        ))}
      </ul>
    </div>
  )
}
