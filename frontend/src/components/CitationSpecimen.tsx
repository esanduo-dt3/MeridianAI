import { motion, useReducedMotion } from 'motion/react'
import { FileText } from '@phosphor-icons/react'
import { ConfidenceLabel } from './ConfidenceLabel'

/*
  A worked example on the sign-in screen, built from real project content:
  the passage and its character offsets come from
  kavia-docs/CodeWiki/Specs/Other/meridian-prd-v2-summary.md (chars 8507–8614).
  The confidence value is illustrative and labelled as an example.
*/
const before = '…every answer must be stored with its chunk citations, confidence and groundedness-check result, '
const cited =
  'guardrail routing must flag anything below threshold for review instead of showing it as a confident answer'
const after = ', every agent-proposed write action must be held for approval…'

export function CitationSpecimen() {
  const reduce = useReducedMotion()
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <figure className="relative w-full max-w-[480px]">
      <figcaption className="mb-3 font-mono text-[11px] tracking-wide text-ink-3">Example · how an answer is traced</figcaption>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="rounded-(--radius-panel) border border-rule bg-surface p-5 shadow-(--shadow-panel)"
      >
        <p className="text-sm text-ink-3">What happens to an answer that isn't well supported?</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          It gets flagged for review instead of being shown as a confident answer
          <sup className="ml-0.5 font-mono text-[11px] font-medium text-cobalt">[1]</sup>
        </p>
        <div className="mt-4 border-t border-rule pt-3">
          <ConfidenceLabel value={0.81} />
        </div>
      </motion.div>

      {/* The connector between the answer and its source: the meridian line. */}
      <div aria-hidden className="relative ml-8 h-7">
        <motion.span
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: 0.45, ease }}
          className="absolute inset-y-0 left-0 w-[2px] origin-top bg-cobalt"
        />
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7, ease }}
        className="rounded-(--radius-panel) border border-rule bg-surface p-5 shadow-(--shadow-panel)"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <FileText aria-hidden size={15} weight="bold" className="text-ink-3" />
            meridian-prd-v2-summary.md
          </span>
          <span className="font-mono text-[11px] text-ink-3 tabular">[1] chars 8507–8614</span>
        </div>
        <p className="mt-3 text-[14px] leading-[1.7] text-ink-2">
          {before}
          {/* Background sweeps across wrapped lines in reading order (box-decoration-break: slice). */}
          <motion.mark
            initial={reduce ? false : { backgroundSize: '0% 100%' }}
            animate={{ backgroundSize: '100% 100%' }}
            transition={{ duration: 1.1, delay: 1.15, ease }}
            className="bg-transparent bg-[linear-gradient(var(--color-mark),var(--color-mark))] bg-no-repeat px-0.5 text-ink"
            style={{ backgroundSize: '100% 100%' }}
          >
            {cited}
          </motion.mark>
          {after}
        </p>
      </motion.div>
    </figure>
  )
}
