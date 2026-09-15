import type { Priority, Task, TaskStatus } from '../lib/types'

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'No priority' },
]

export const statusLabel = (status: TaskStatus) => STATUSES.find((s) => s.value === status)!.label
export const priorityLabel = (priority: Priority) => PRIORITIES.find((p) => p.value === priority)!.label

export interface TaskNode {
  task: Task
  children: TaskNode[]
  /** Done and total across all descendants, for the progress bar. */
  progress: { done: number; total: number }
}

const byPosition = (a: Task, b: Task) => a.position - b.position || a.created_at.localeCompare(b.created_at)

/** Builds the subtask tree. Orphans (parent filtered out or missing) are shown at the top level. */
export function buildTree(tasks: Task[]): TaskNode[] {
  const ids = new Set(tasks.map((t) => t.id))
  const childrenOf = new Map<string | null, Task[]>()
  for (const task of tasks) {
    const parent = task.parent_task_id && ids.has(task.parent_task_id) ? task.parent_task_id : null
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), task])
  }

  const build = (parent: string | null): TaskNode[] =>
    (childrenOf.get(parent) ?? []).sort(byPosition).map((task) => {
      const children = build(task.id)
      const progress = children.reduce(
        (acc, child) => ({
          done: acc.done + (child.task.status === 'done' ? 1 : 0) + child.progress.done,
          total: acc.total + 1 + child.progress.total,
        }),
        { done: 0, total: 0 },
      )
      return { task, children, progress }
    })

  return build(null)
}

/** Keeps matching tasks plus the ancestors needed to show them in context. */
export function filterTasks(tasks: Task[], query: string, showCompleted: boolean): Task[] {
  const q = query.trim().toLowerCase()
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const matches = tasks.filter(
    (t) =>
      (showCompleted || t.status !== 'done') &&
      (!q || t.title.toLowerCase().includes(q) || (t.assignee?.full_name ?? t.assignee?.email ?? '').toLowerCase().includes(q)),
  )
  const keep = new Set<string>()
  for (const task of matches) {
    let current: Task | undefined = task
    while (current && !keep.has(current.id)) {
      keep.add(current.id)
      current = current.parent_task_id ? byId.get(current.parent_task_id) : undefined
    }
  }
  return tasks.filter((t) => keep.has(t.id))
}

/** A position between two neighbours, so a reorder changes only the moved task. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2
  if (before !== undefined) return before + 1024
  if (after !== undefined) return after - 1024
  return Date.now()
}

export function isOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${task.due_date}T00:00:00`) < today
}

const dueFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
export const formatDue = (date: string) => dueFormat.format(new Date(`${date}T00:00:00`))
