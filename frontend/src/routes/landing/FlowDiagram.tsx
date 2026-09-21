import { useEffect, useId, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  ChatCircleText,
  FileMagnifyingGlass,
  ListChecks,
  Quotes,
  UploadSimple,
  type Icon,
} from '@phosphor-icons/react'

/*
  Animated explanation of the Meridian loop.

  Every stage below maps to behaviour that exists in this repository: ingestion
  (`rag/ingest.py`, DocumentsPage), retrieval (`rag/fusion.py`, `rag/rerank.py`),
  grounded answers with citations (`rag/answer.py`, AnswerPanel), review routing
  (ConfidenceLabel, /admin/review) and the note/task outcome (NotesPage,
  TasksPage). Nothing here claims a capability the product does not have.
*/

interface Stage {
  id: string
  icon: Icon
  title: string
  /** One-line label shown inside the node. */
  caption: string
  /** Longer explanation revealed when the stage is active. */
  detail: string
}

const STAGES: Stage[] = [
  {
    id: 'ingest',
    icon: UploadSimple,
    title: 'Your documents',
    caption: 'PDFs and Word files',
    detail:
      'You upload the files your team already works from. Meridian parses them, splits them into passages and indexes them inside your workspace only.',
  },
  {
    id: 'ask',
    icon: ChatCircleText,
    title: 'Your question',
    caption: 'Asked in plain language',
    detail:
      'Ask the assistant the way you would ask a colleague. No query syntax, no need to know which document holds the answer.',
  },
  {
    id: 'retrieve',
    icon: FileMagnifyingGlass,
    title: 'Retrieval',
    caption: 'Matching passages ranked',
    detail:
      'Meridian searches across your indexed passages, fuses the results and re-ranks them, so the strongest evidence reaches the model first.',
  },
  {
    id: 'answer',
    icon: Quotes,
    title: 'Grounded answer',
    caption: 'Cited, with confidence',
    detail:
      'The answer is drafted only from the retrieved passages. Each claim links to its source, and an uncalibrated confidence value tells you when to look closer.',
  },
  {
    id: 'act',
    icon: ListChecks,
    title: 'You decide',
    caption: 'Note, task, or review',
    detail:
      'Check the cited passage, then capture the outcome as a note or a task. Weak answers go to a reviewer, and agent-suggested tasks wait for an Admin to approve them.',
  },
]

const CYCLE_MS = 2800

// PUBLIC_INTERFACE
export function FlowDiagram() {
  /**
   * Animated flow chart of the Meridian pipeline.
   *
   * The active stage advances on a timer so the whole loop explains itself
   * without interaction. Pointer hover, keyboard focus and explicit selection
   * all pause the timer, and the entire animation is suppressed when the user
   * has asked for reduced motion (the diagram then renders as a static,
   * fully-legible chart with every stage reachable by keyboard).
   */
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const gradientId = useId()

  useEffect(() => {
    if (reduce || paused) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % STAGES.length)
    }, CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [reduce, paused])

  const activeStage = STAGES[active]

  return (
    <div
      className="liquid-glass rounded-[20px] p-5 sm:p-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.16em] text-ink-3 uppercase">The loop, end to end</p>
        <p aria-live="polite" className="text-xs text-ink-3">
          Stage {active + 1} of {STAGES.length} · {activeStage.title}
        </p>
      </div>

      {/* Stage nodes. Vertical on small screens, a left-to-right flow from md up. */}
      <ol className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
        {STAGES.map((stage, index) => {
          const isActive = index === active
          const isPast = index < active
          return (
            <li key={stage.id} className="flex flex-1 items-center gap-3 md:flex-col md:gap-2">
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${stage.title}: ${stage.detail}`}
                className={`group relative flex w-full min-w-0 cursor-pointer flex-col items-start gap-2 rounded-(--radius-panel) border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-(--duration-panel) ease-(--ease-out-quint) ${
                  isActive
                    ? 'border-cobalt/40 bg-[var(--glass-raised)] shadow-(--shadow-panel) md:-translate-y-0.5'
                    : 'border-[var(--glass-edge)] bg-transparent hover:bg-[var(--glass-raised)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) transition-colors duration-(--duration-panel) ${
                    isActive || isPast ? 'bg-cobalt-wash text-cobalt' : 'bg-sunken text-ink-3'
                  }`}
                >
                  <stage.icon size={20} weight={isActive ? 'fill' : 'bold'} />
                </span>

                <span className="min-w-0">
                  <span className="block font-display text-[15px] leading-snug font-semibold tracking-[-0.015em] text-ink">
                    {stage.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{stage.caption}</span>
                </span>

                {/* Progress underline: fills while the stage is active. */}
                <span aria-hidden className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--glass-edge)]">
                  <motion.span
                    key={`${stage.id}-${isActive}-${paused}`}
                    className="block h-full rounded-full bg-cobalt"
                    initial={{ width: isPast ? '100%' : '0%' }}
                    animate={{ width: isActive || isPast ? '100%' : '0%' }}
                    transition={{
                      duration: reduce || paused || !isActive ? 0 : CYCLE_MS / 1000,
                      ease: 'linear',
                    }}
                  />
                </span>
              </button>

              {/* Connector to the next stage. Decorative: the order is already in the list. */}
              {index < STAGES.length - 1 && (
                <span aria-hidden className="hidden shrink-0 self-center text-ink-3 md:block">
                  <ArrowRight size={16} weight="bold" className={isPast ? 'text-cobalt' : undefined} />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Animated current running through the flow, echoing the stage order. */}
      <svg
        aria-hidden
        viewBox="0 0 600 8"
        preserveAspectRatio="none"
        className="mt-5 hidden h-2 w-full md:block"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--color-cobalt)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--color-cobalt)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--color-cobalt)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <line x1="0" y1="4" x2="600" y2="4" stroke="var(--glass-edge)" strokeWidth="2" strokeLinecap="round" />
        <line
          x1="0"
          y1="4"
          x2="600"
          y2="4"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="10 14"
          style={reduce ? undefined : { animation: 'meridian-flow-dash 900ms linear infinite' }}
        />
      </svg>

      {/* Detail for the active stage, announced politely as the flow advances. */}
      <motion.p
        key={activeStage.id}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-ink-2"
      >
        {activeStage.detail}
      </motion.p>
    </div>
  )
}
