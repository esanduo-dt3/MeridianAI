import { useState } from 'react'
import { Check, ClockCounterClockwise, PencilSimple, Robot, Tray, X } from '@phosphor-icons/react'
import { ConfidenceReadout, FlagReasons, GroundednessBadge } from '../../agent/AnswerSignals'
import { AnswerText } from '../../agent/AnswerText'
import { useReviewMutations, useReviewQueue } from '../../admin/useAdmin'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, Skeleton } from '../../components/Feedback'
import { OperationalHeader } from '../../components/OperationalHeader'
import { errorText } from '../../lib/queryClient'
import type { RecentDecision, ReviewAction, ReviewAnswer } from '../../lib/types'
import { PriorityIcon } from '../../tasks/TaskBits'
import { formatDue } from '../../tasks/taskModel'
import { AdminOnly } from '../../workspace/AdminOnly'

const stamp = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * Flagged answers and pending agent actions, each needing a person's decision
 * (D-040). Every decision is written with its audit entry in one transaction.
 */
// PUBLIC_INTERFACE
export function ReviewQueuePage() {
  return (
    <div className="flex flex-col gap-5">
      <OperationalHeader
        eyebrow="Administrator review"
        title="Review queue"
        description="Low-confidence, uncited or ungrounded answers and agent-proposed actions. Each decision is recorded in the audit log."
        status={
          <span className="rounded-full bg-flag-wash px-2.5 py-1 text-xs font-medium text-flag">
            Human decision required
          </span>
        }
      />
      <AdminOnly>
        <Queue />
      </AdminOnly>
    </div>
  )
}

function Queue() {
  const queue = useReviewQueue()
  if (queue.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading the review queue">
        <Skeleton className="h-40 w-full rounded-(--radius-panel)" />
        <Skeleton className="h-24 w-full rounded-(--radius-panel)" />
      </div>
    )
  }
  if (queue.isError) {
    return <ErrorState title="The review queue couldn't be loaded" message={errorText(queue.error)} onRetry={() => void queue.refetch()} />
  }
  const { answers, actions, recent } = queue.data

  return (
    <>
      {answers.length === 0 && actions.length === 0 ? (
        <EmptyState icon={Tray} title="Nothing waiting for review">
          Flagged answers and agent proposals appear here. Everything decided so far is listed below and in the audit log.
        </EmptyState>
      ) : (
        <>
          <Section title="Flagged answers" count={answers.length}>
            {answers.map((a) => (
              <AnswerCard key={a.id} answer={a} />
            ))}
          </Section>
          <Section title="Proposed actions" count={actions.length}>
            {actions.map((a) => (
              <ActionCard key={a.id} action={a} />
            ))}
          </Section>
        </>
      )}
      {recent.length > 0 && (
        <Section title="Recent decisions" count={recent.length}>
          <ul className="divide-y divide-rule rounded-(--radius-panel) border border-rule bg-surface">
            {recent.map((d) => (
              <DecisionRow key={`${d.kind}-${d.target_id}`} decision={d} />
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-rule bg-paper p-3 sm:p-4">
      <h2 className="text-sm font-semibold text-ink">
        {title} <span className="font-sans text-base font-normal text-ink-3">· {count}</span>
      </h2>
      {children}
    </section>
  )
}

function AnswerCard({ answer }: { answer: ReviewAnswer }) {
  const { reviewAnswer } = useReviewMutations()
  const [mode, setMode] = useState<'idle' | 'correct'>('idle')
  const [notes, setNotes] = useState('')
  const [correction, setCorrection] = useState('')
  const busy = reviewAnswer.isPending && reviewAnswer.variables?.id === answer.id

  function decide(decision: 'confirmed' | 'corrected' | 'dismissed') {
    reviewAnswer.mutate({
      id: answer.id,
      decision,
      notes: notes.trim() || undefined,
      correction: decision === 'corrected' ? correction.trim() : undefined,
    })
  }

  return (
    <article className="flex flex-col gap-3 rounded-(--radius-panel) border border-rule bg-surface p-5">
      <p className="text-sm text-ink-3">
        {answer.asked_by ?? 'Someone'} asked · {stamp.format(new Date(answer.created_at))}
        {answer.model && <span className="font-mono text-[11px]"> · {answer.model}</span>}
      </p>
      <p className="font-medium text-ink">{answer.question}</p>
      <AnswerText text={answer.answer} citations={answer.citations} className="text-[15px] leading-[1.7] text-ink-2" />
      {answer.citations.length === 0 && <p className="text-[13px] text-ink-3">No passages cited.</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ConfidenceReadout confidence={{ ...answer.confidence, basis: '' }} />
        <GroundednessBadge grounded={answer.groundedness_pass} />
      </div>
      <FlagReasons reasons={answer.flag_reasons} />

      <div className="flex flex-col gap-2 border-t border-rule pt-3">
        {mode === 'correct' && (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Corrected answer
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              rows={3}
              className="rounded-(--radius-control) border border-rule-strong bg-surface px-3 py-2 text-[15px] font-normal text-ink focus:border-cobalt focus:outline-none"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Note <span className="font-normal text-ink-3">(optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-10 rounded-(--radius-control) border border-rule-strong bg-surface px-3 text-[15px] font-normal text-ink focus:border-cobalt focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {mode === 'correct' ? (
            <>
              <Button onClick={() => decide('corrected')} disabled={!correction.trim()} loading={busy}>
                Save correction
              </Button>
              <Button variant="ghost" onClick={() => setMode('idle')} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => decide('confirmed')} loading={busy} leading={<Check aria-hidden size={16} weight="bold" />}>
                Confirm
              </Button>
              <Button variant="secondary" onClick={() => setMode('correct')} disabled={busy} leading={<PencilSimple aria-hidden size={16} weight="bold" />}>
                Correct
              </Button>
              <Button variant="ghost" onClick={() => decide('dismissed')} disabled={busy} leading={<X aria-hidden size={16} weight="bold" />}>
                Dismiss
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

function ActionCard({ action }: { action: ReviewAction }) {
  const { decideAction } = useReviewMutations()
  const p = action.proposed_payload
  const busy = decideAction.isPending && decideAction.variables?.id === action.id
  return (
    <article className="flex flex-col gap-3 rounded-(--radius-panel) border border-cobalt/25 bg-cobalt-wash/40 p-5 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-cobalt">
          <Robot aria-hidden size={13} weight="bold" /> Agent proposal · {stamp.format(new Date(action.created_at))}
        </p>
        <p className="mt-1 flex items-center gap-2 font-medium text-ink">
          {p.priority && p.priority !== 'none' && <PriorityIcon priority={p.priority} />}
          {p.title || 'Untitled proposal'}
          {p.due_date && <span className="font-mono text-xs font-normal text-ink-3">due {formatDue(p.due_date)}</span>}
        </p>
        {p.description && <p className="mt-1 text-sm text-ink-2">{p.description}</p>}
        <p className="mt-2 text-sm text-ink-2">
          <span className="font-medium text-ink-3">Why: </span>
          {action.reasoning}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => decideAction.mutate({ id: action.id, approve: true })} loading={busy} leading={<Check aria-hidden size={16} weight="bold" />}>
          Approve
        </Button>
        <Button variant="secondary" onClick={() => decideAction.mutate({ id: action.id, approve: false })} disabled={busy}>
          Reject
        </Button>
      </div>
    </article>
  )
}

const DECISION_STYLE: Record<RecentDecision['decision'], string> = {
  confirmed: 'bg-grounded-wash text-grounded',
  approved: 'bg-grounded-wash text-grounded',
  corrected: 'bg-flag-wash text-flag',
  dismissed: 'bg-sunken text-ink-2',
  rejected: 'bg-sunken text-ink-2',
}

function DecisionRow({ decision }: { decision: RecentDecision }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DECISION_STYLE[decision.decision]}`}>
        {decision.decision}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink">
        <span className="text-ink-3">{decision.kind === 'answer' ? 'Answer: ' : 'Task: '}</span>
        {decision.summary || '(no summary)'}
        {decision.correction && <span className="block text-[13px] text-ink-2">Correction: {decision.correction}</span>}
      </span>
      <span className="flex items-center gap-1 text-xs text-ink-3">
        <ClockCounterClockwise aria-hidden size={12} />
        {decision.by ?? 'unknown'} · {stamp.format(new Date(decision.at))}
      </span>
    </li>
  )
}
