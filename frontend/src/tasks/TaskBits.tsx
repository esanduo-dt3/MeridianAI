import { CalendarBlank, Check, Robot, WarningDiamond } from '@phosphor-icons/react'
import { Avatar } from '../components/Avatar'
import type { Person, Priority, Task, TaskStatus } from '../lib/types'
import { formatDue, isOverdue, priorityLabel, statusLabel } from './taskModel'

interface StatusCircleProps {
  status: TaskStatus
  onToggle?: () => void
  title: string
  size?: number
}

/** Round checkbox: empty for To do, half for In progress, filled check for Done. */
export function StatusCircle({ status, onToggle, title, size = 18 }: StatusCircleProps) {
  const done = status === 'done'
  const inner = (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`relative grid shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-150 ${
        done
          ? 'border-grounded bg-grounded text-on-ink'
          : status === 'in_progress'
            ? 'border-cobalt'
            : 'border-rule-strong group-hover/status:border-ink-3'
      }`}
    >
      {done && <Check size={size * 0.6} weight="bold" />}
      {status === 'in_progress' && (
        <span className="absolute inset-[3px] rounded-full bg-[conic-gradient(var(--color-cobalt)_0_50%,transparent_50%_100%)]" />
      )}
    </span>
  )

  if (!onToggle) {
    return (
      <span role="img" aria-label={`${statusLabel(status)}: ${title}`} className="grid size-7 place-items-center">
        {inner}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      role="checkbox"
      aria-checked={done ? true : status === 'in_progress' ? 'mixed' : false}
      aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
      className="group/status grid size-7 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-sunken"
    >
      {inner}
    </button>
  )
}

const LEVEL: Record<Priority, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 }

/** Three signal bars filled by priority; urgent is a warning mark. */
export function PriorityIcon({ priority, className = '' }: { priority: Priority; className?: string }) {
  const label = priorityLabel(priority)
  if (priority === 'urgent') {
    return (
      <span role="img" aria-label={`Priority: ${label}`} title={label} className={`grid size-5 place-items-center text-danger ${className}`}>
        <WarningDiamond size={16} weight="fill" />
      </span>
    )
  }
  const level = LEVEL[priority]
  const color = priority === 'high' ? 'bg-flag' : 'bg-ink-2'
  return (
    <span role="img" aria-label={`Priority: ${label}`} title={label} className={`flex size-5 items-end justify-center gap-[2px] pb-[3px] ${className}`}>
      {[1, 2, 3].map((bar) => (
        <span key={bar} style={{ height: 3 + bar * 3 }} className={`w-[3px] rounded-[1px] ${bar <= level ? color : 'bg-rule-strong'}`} />
      ))}
    </span>
  )
}

export function DueDate({ task, compact = false }: { task: Task; compact?: boolean }) {
  if (!task.due_date) return null
  const overdue = isOverdue(task)
  return (
    <span
      title={overdue ? `Overdue: was due ${formatDue(task.due_date)}` : `Due ${formatDue(task.due_date)}`}
      className={`inline-flex items-center gap-1 font-mono text-xs tabular whitespace-nowrap ${overdue ? 'text-danger' : 'text-ink-3'}`}
    >
      {!compact && <CalendarBlank aria-hidden size={13} weight="bold" />}
      {formatDue(task.due_date)}
      {overdue && <span className="sr-only">(overdue)</span>}
    </span>
  )
}

export function Assignee({ person, size = 24 }: { person: Person | null; size?: number }) {
  if (!person) {
    return (
      <span
        role="img"
        aria-label="Unassigned"
        title="Unassigned"
        style={{ width: size, height: size }}
        className="block shrink-0 rounded-full border border-dashed border-rule-strong"
      />
    )
  }
  const name = person.full_name || person.email
  return (
    <span role="img" aria-label={`Assigned to ${name}`} title={name} className="block shrink-0">
      <Avatar name={person.full_name} email={person.email} src={person.avatar_url} size={size} />
    </span>
  )
}

export function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null
  const complete = done === total
  return (
    <span className="inline-flex items-center gap-2" title={`${done} of ${total} subtasks done`}>
      <span aria-hidden className="h-[3px] w-10 overflow-hidden rounded-full bg-rule">
        <span
          className={`block h-full rounded-full ${complete ? 'bg-grounded' : 'bg-flag'}`}
          style={{ width: `${(done / total) * 100}%` }}
        />
      </span>
      <span className="font-mono text-xs text-ink-3 tabular">
        {done}/{total}
        <span className="sr-only"> subtasks done</span>
      </span>
    </span>
  )
}

export function AgentBadge() {
  return (
    <span
      title="Proposed by the agent and approved by an Admin"
      className="inline-flex items-center gap-1 rounded-full bg-cobalt-wash px-1.5 py-px text-[11px] font-medium text-cobalt"
    >
      <Robot aria-hidden size={12} weight="bold" />
      Agent
    </span>
  )
}
