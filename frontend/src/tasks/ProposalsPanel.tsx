import { Check, Robot, X } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import type { Proposal } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { PriorityIcon } from './TaskBits'
import { formatDue } from './taskModel'
import { useTaskMutations } from './useTasks'

/**
 * Agent-proposed tasks held for a person's decision (non-negotiable 1).
 * Nothing here is in the task list until an Admin approves it.
 */
export function ProposalsPanel({ proposals }: { proposals: Proposal[] }) {
  const { isAdmin } = useWorkspace()
  const { approve, reject } = useTaskMutations()
  if (proposals.length === 0) return null

  return (
    <section
      aria-labelledby="proposals-heading"
      className="rounded-(--radius-panel) border border-cobalt/25 bg-cobalt-wash/50 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Robot aria-hidden size={18} weight="bold" className="text-cobalt" />
        <h2 id="proposals-heading" className="font-medium text-ink">
          Proposed by the agent · {proposals.length}
        </h2>
        <p className="w-full text-sm text-ink-2 sm:ml-auto sm:w-auto">
          {isAdmin ? 'Nothing is added until you approve it.' : 'Waiting for an Admin to approve or reject.'}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {proposals.map((proposal) => {
          const payload = proposal.proposed_payload
          const deciding = (approve.isPending && approve.variables === proposal.id) || (reject.isPending && reject.variables === proposal.id)
          return (
            <li key={proposal.id} className="flex flex-col gap-3 rounded-(--radius-control) border border-rule bg-surface p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium text-ink">
                  {payload.priority && payload.priority !== 'none' && <PriorityIcon priority={payload.priority} />}
                  <span className="truncate">{payload.title || 'Untitled proposal'}</span>
                  {payload.due_date && <span className="font-mono text-xs font-normal text-ink-3">due {formatDue(payload.due_date)}</span>}
                </p>
                {payload.description && <p className="mt-1 text-sm text-ink-2">{payload.description}</p>}
                <p className="mt-2 text-sm text-ink-2">
                  <span className="font-medium text-ink-3">Why: </span>
                  {proposal.reasoning}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="min-h-10 text-sm"
                    disabled={deciding}
                    loading={reject.isPending && reject.variables === proposal.id}
                    onClick={() => reject.mutate(proposal.id)}
                    leading={<X aria-hidden size={15} weight="bold" />}
                  >
                    Reject
                  </Button>
                  <Button
                    className="min-h-10 text-sm"
                    disabled={deciding}
                    loading={approve.isPending && approve.variables === proposal.id}
                    onClick={() => approve.mutate(proposal.id)}
                    leading={<Check aria-hidden size={15} weight="bold" />}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
