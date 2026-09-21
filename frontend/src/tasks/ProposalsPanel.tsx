import { useState } from 'react'
import { CaretDown, Check, Robot, X } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import type { Proposal } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { PriorityIcon } from './TaskBits'
import { formatDue } from './taskModel'
import { useTaskMutations } from './useTasks'

/**
 * How many proposals are visible before an explicit reveal control (DEC-09).
 * A count cap keeps the panel's height bounded no matter how many proposals
 * the agent produces, so the first task row stays inside the vertical budget.
 */
const VISIBLE_ROWS = 3

// PUBLIC_INTERFACE
/**
 * Agent-proposed tasks held for a person's decision (non-negotiable 1).
 *
 * Nothing here is in the task list until an Admin approves it. The area is
 * deliberately compact: at most `VISIBLE_ROWS` dense rows render before the
 * reveal control, and each proposal's description and reasoning stay behind a
 * per-row disclosure so the panel cannot push the task list down the page.
 * Approve and Reject remain on the collapsed row for Admins, because hiding a
 * decision behind a disclosure would make it less visible than the suggestion
 * it acts on.
 *
 * @param proposals - Pending proposals for the active workspace. An empty
 *   array renders nothing at all.
 * @returns The bounded proposal area, or `null` when there is nothing pending.
 */
export function ProposalsPanel({ proposals }: { proposals: Proposal[] }) {
  const { isAdmin } = useWorkspace()
  const { approve, reject } = useTaskMutations()
  // At most one reasoning block is open, so an expansion cannot compound.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  if (proposals.length === 0) return null

  const overflowing = proposals.length > VISIBLE_ROWS
  const visible = showAll ? proposals : proposals.slice(0, VISIBLE_ROWS)

  return (
    <section
      aria-labelledby="proposals-heading"
      className="rounded-(--radius-panel) border border-cobalt/25 bg-cobalt-wash/50 px-3 py-2.5 sm:px-3.5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Robot aria-hidden size={16} weight="bold" className="text-cobalt" />
        <h2 id="proposals-heading" className="text-sm font-medium text-ink">
          Proposed by the agent · {proposals.length}
        </h2>
        {/* Both sentences stay visible text: Members need to learn why they cannot decide. */}
        <p className="text-sm text-ink-2 sm:ml-auto">
          {isAdmin ? 'Nothing is added until you approve it.' : 'Waiting for an Admin to approve or reject.'}
        </p>
      </div>

      <ul
        id="proposals-list"
        className={`mt-2 flex flex-col gap-1.5 ${showAll ? 'max-h-72 overflow-y-auto' : ''}`}
      >
        {visible.map((proposal) => {
          const payload = proposal.proposed_payload
          const title = payload.title || 'Untitled proposal'
          const deciding = (approve.isPending && approve.variables === proposal.id) || (reject.isPending && reject.variables === proposal.id)
          const whyId = `proposal-why-${proposal.id}`
          const expanded = expandedId === proposal.id

          return (
            <li
              key={proposal.id}
              className="rounded-(--radius-control) border border-[var(--glass-edge)] bg-[var(--glass-raised)] px-2.5 py-1.5"
            >
              <div className="flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                {payload.priority && payload.priority !== 'none' && <PriorityIcon priority={payload.priority} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{title}</span>
                {payload.due_date && (
                  <span className="font-mono text-xs whitespace-nowrap text-ink-3 tabular">due {formatDue(payload.due_date)}</span>
                )}

                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={whyId}
                  title={`Why the agent proposed "${title}"`}
                  onClick={() => setExpandedId(expanded ? null : proposal.id)}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-(--radius-control) px-2 text-sm text-ink-2 transition-colors duration-150 ease-out hover:bg-[var(--glass-raised)] hover:text-ink"
                >
                  Why
                  <CaretDown
                    aria-hidden
                    size={13}
                    weight="bold"
                    className={`transition-transform duration-150 ease-out ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isAdmin && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="secondary"
                      className="min-h-10 px-3 text-sm"
                      disabled={deciding}
                      loading={reject.isPending && reject.variables === proposal.id}
                      onClick={() => reject.mutate(proposal.id)}
                      leading={<X aria-hidden size={15} weight="bold" />}
                    >
                      Reject
                    </Button>
                    <Button
                      className="min-h-10 px-3 text-sm"
                      disabled={deciding}
                      loading={approve.isPending && approve.variables === proposal.id}
                      onClick={() => approve.mutate(proposal.id)}
                      leading={<Check aria-hidden size={15} weight="bold" />}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>

              {/* Mounted only while expanded, so a collapsed panel has no hidden height. */}
              {expanded && (
                <div
                  id={whyId}
                  role="region"
                  aria-label={`Why the agent proposed "${title}"`}
                  className="border-t border-[var(--glass-edge)] pt-2 pb-1"
                >
                  {payload.description && <p className="text-sm text-ink-2">{payload.description}</p>}
                  <p className={`text-sm text-ink-2 ${payload.description ? 'mt-1.5' : ''}`}>
                    <span className="font-medium text-ink-3">Why: </span>
                    {proposal.reasoning}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {overflowing && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center rounded-(--radius-control) px-1 text-sm font-medium text-cobalt transition-colors duration-150 ease-out hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${proposals.length}`}
        </button>
      )}
    </section>
  )
}
