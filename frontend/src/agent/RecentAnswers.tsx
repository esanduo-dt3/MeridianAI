import { CaretDown, ClockCounterClockwise } from '@phosphor-icons/react'
import { ErrorState, Skeleton } from '../components/Feedback'
import { errorText } from '../lib/queryClient'
import type { AnswerListItem } from '../lib/types'
import { ConfidenceReadout, FlaggedBadge, GroundednessBadge } from './AnswerSignals'
import { AnswerText } from './AnswerText'
import { flagReasonText } from './answerModel'
import { useRecentAnswers } from './useRecentAnswers'

const stamp = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/*
  The asker's own recent questions (GET /agent/answers). The list endpoint
  returns the stored answer text but not its citation targets, so the [n]
  markers here are shown as written and are not links; ask again to open the
  passages.
*/
export function RecentAnswers() {
  const answers = useRecentAnswers()

  if (answers.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading recent answers">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-(--radius-panel)" />
        ))}
      </div>
    )
  }
  if (answers.isError) {
    return (
      <ErrorState
        title="Recent answers couldn't be loaded"
        message={errorText(answers.error)}
        onRetry={() => void answers.refetch()}
      />
    )
  }
  if (answers.data.length === 0) {
    return (
      <p className="flex gap-2 rounded-(--radius-panel) border border-dashed border-rule-strong px-4 py-3.5 text-[13px] text-ink-3">
        <ClockCounterClockwise aria-hidden size={15} weight="bold" className="mt-0.5 shrink-0" />
        Questions you ask in this workspace are kept here, with the confidence and groundedness result they had.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      {answers.data.map((answer) => (
        <li key={answer.id}>
          <RecentAnswerRow answer={answer} />
        </li>
      ))}
    </ol>
  )
}

function RecentAnswerRow({ answer }: { answer: AnswerListItem }) {
  return (
    <details className="group rounded-(--radius-panel) border border-rule bg-surface">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <CaretDown
          aria-hidden
          size={14}
          weight="bold"
          className="mt-1 shrink-0 text-ink-3 transition-transform group-open:rotate-180"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-medium break-words text-ink">{answer.question}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[11px] text-ink-3">{stamp.format(new Date(answer.created_at))}</span>
            <ConfidenceReadout confidence={answer.confidence} />
            <GroundednessBadge grounded={answer.groundedness_pass} />
            {answer.flagged && <FlaggedBadge />}
            {answer.model && (
              <span className="font-mono text-[11px] text-ink-3" title="The model that answered. Free-tier fallbacks change it.">
                {answer.model}
              </span>
            )}
          </span>
        </span>
      </summary>
      <div className="border-t border-rule px-4 py-3.5">
        <AnswerText text={answer.answer} className="text-[14.5px] leading-[1.75] text-ink-2" />
        {answer.flagged && answer.flag_reasons.length > 0 && (
          <p className="mt-3 text-[13px] leading-relaxed text-flag">
            {answer.flag_reasons.map(flagReasonText).join(' ')}
          </p>
        )}
      </div>
    </details>
  )
}
