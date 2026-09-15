interface ConfidenceLabelProps {
  /** Combined reranker score and grading verdict, 0 to 1. */
  value: number
  className?: string
}

/**
 * The only way the UI renders a confidence value. It always carries the
 * "uncalibrated" label, so a bare number can never reach the screen.
 */
export function ConfidenceLabel({ value, className = '' }: ConfidenceLabelProps) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 font-mono text-xs text-ink-2 ${className}`}
      title="Combined reranker score and grading verdict. Not a probability that the answer is correct."
    >
      <span>confidence</span>
      <span className="tabular font-medium text-ink">{clamped.toFixed(2)}</span>
      <span className="rounded-[4px] border border-rule-strong px-1 py-px text-[10px] tracking-wide text-ink-3 uppercase">
        uncalibrated
      </span>
    </span>
  )
}
