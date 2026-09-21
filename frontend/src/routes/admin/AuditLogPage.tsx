import { useState, type FormEvent } from 'react'
import { Gear, ListMagnifyingGlass, MagnifyingGlass, Robot, User } from '@phosphor-icons/react'
import { type AuditFilters, useAuditLog } from '../../admin/useAdmin'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, Skeleton } from '../../components/Feedback'
import { SelectField, TextField } from '../../components/Field'
import { OperationalHeader } from '../../components/OperationalHeader'
import { WorkspaceToolbar } from '../../components/WorkspaceToolbar'
import { errorText } from '../../lib/queryClient'
import type { AuditEntry } from '../../lib/types'
import { AdminOnly } from '../../workspace/AdminOnly'

const stamp = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
})

/** Every prediction, proposal and decision, timestamped and attributable (PRD 13). */
// PUBLIC_INTERFACE
export function AuditLogPage() {
  return (
    <div className="flex flex-col gap-5">
      <OperationalHeader
        eyebrow="Administrator evidence"
        title="Audit log"
        description="Every answer, agent turn, proposed action and review decision, with the time and who or what made it."
      />
      <AdminOnly>
        <Log />
      </AdminOnly>
    </div>
  )
}

function Log() {
  const [draft, setDraft] = useState<AuditFilters>({ actorType: '', action: '' })
  const [filters, setFilters] = useState<AuditFilters>(draft)
  const log = useAuditLog(filters)

  function apply(event: FormEvent) {
    event.preventDefault()
    setFilters(draft)
  }

  const entries = log.data?.pages.flatMap((p) => p.entries) ?? []

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceToolbar label="Audit filters">
        <form onSubmit={apply} className="flex w-full flex-wrap items-end gap-3">
          <SelectField
            label="Made by"
            value={draft.actorType}
            onChange={(e) => {
              const next = { ...draft, actorType: e.target.value as AuditFilters['actorType'] }
              setDraft(next)
              setFilters(next)
            }}
            wrapperClassName="w-44"
          >
            <option value="">Anyone</option>
            <option value="user">People</option>
            <option value="agent">The agent</option>
            <option value="system">The system</option>
          </SelectField>
          <TextField
            label="Action contains"
            placeholder="e.g. agent_action, answer.reviewed"
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            wrapperClassName="min-w-[14rem] flex-1"
          />
          <Button type="submit" variant="secondary" leading={<MagnifyingGlass aria-hidden size={16} weight="bold" />}>
            Filter
          </Button>
        </form>
      </WorkspaceToolbar>

      {log.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading the audit log">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-(--radius-control)" />
          ))}
        </div>
      ) : log.isError ? (
        <ErrorState title="The audit log couldn't be loaded" message={errorText(log.error)} onRetry={() => void log.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState icon={ListMagnifyingGlass} title="No matching entries">
          {filters.actorType || filters.action ? 'Nothing matches these filters.' : 'Entries are written by people, the agent and the system.'}
        </EmptyState>
      ) : (
        <>
          <ol className="divide-y divide-rule rounded-(--radius-panel) border border-rule bg-surface">
            {entries.map((e) => (
              <Entry key={e.id} entry={e} />
            ))}
          </ol>
          {log.hasNextPage && (
            <Button variant="secondary" className="self-start" onClick={() => void log.fetchNextPage()} loading={log.isFetchingNextPage}>
              Load older entries
            </Button>
          )}
        </>
      )}
    </div>
  )
}

const ACTOR = {
  user: { icon: User, label: 'Person', className: 'bg-sunken text-ink-2' },
  agent: { icon: Robot, label: 'Agent', className: 'bg-cobalt-wash text-cobalt' },
  system: { icon: Gear, label: 'System', className: 'bg-sunken text-ink-3' },
} as const

function Entry({ entry }: { entry: AuditEntry }) {
  const actor = ACTOR[entry.actor_type]
  const ActorIcon = actor.icon
  const who = entry.actor?.full_name || entry.actor?.email
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper [&::-webkit-details-marker]:hidden">
          <span className="w-44 shrink-0 font-mono text-xs text-ink-3 tabular">{stamp.format(new Date(entry.timestamp))}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${actor.className}`}>
            <ActorIcon aria-hidden size={12} weight="bold" />
            {actor.label}
          </span>
          <span className="font-mono text-[13px] text-ink">{entry.action}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{who ?? ''}</span>
          {entry.target_type && <span className="text-xs text-ink-3">{entry.target_type}</span>}
        </summary>
        <div className="overflow-x-auto border-t border-rule bg-paper px-4 py-3">
          {entry.target_id && <p className="mb-2 font-mono text-[11px] text-ink-3">target {entry.target_id}</p>}
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-2">{JSON.stringify(entry.details, null, 2)}</pre>
        </div>
      </details>
    </li>
  )
}
