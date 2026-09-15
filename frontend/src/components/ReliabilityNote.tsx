import { Info } from '@phosphor-icons/react'

interface ReliabilityNoteProps {
  compact?: boolean
}

/** Required by the PRD wherever answers appear: answers can be wrong, citations and confidence are how you check. */
export function ReliabilityNote({ compact = false }: ReliabilityNoteProps) {
  if (compact) {
    return (
      <p className="flex gap-2 text-xs leading-relaxed text-ink-3">
        <Info aria-hidden size={14} weight="bold" className="mt-0.5 shrink-0" />
        <span>Answers can be wrong. Check the cited passage before you act on one.</span>
      </p>
    )
  }

  return (
    <aside
      aria-label="Reliability note"
      className="flex gap-3 rounded-(--radius-panel) border border-rule bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-2"
    >
      <Info aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0 text-ink-3" />
      <p>
        AI answers and agent actions can be incomplete or wrong. Every answer cites the exact passage it used and
        shows a confidence value that is <strong className="font-medium text-ink">uncalibrated</strong>, so it is not a
        probability. Low-confidence or ungrounded answers go to a person for review.
      </p>
    </aside>
  )
}
