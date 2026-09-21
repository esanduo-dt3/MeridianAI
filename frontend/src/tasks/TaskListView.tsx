import { useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import type { Task } from '../lib/types'
import { AgentBadge, Assignee, DueDate, PriorityIcon, Progress, StatusCircle } from './TaskBits'
import type { TaskNode } from './taskModel'
import { useTaskMutations } from './useTasks'

interface TaskListViewProps {
  nodes: TaskNode[]
  onOpen: (task: Task) => void
  /** When filtering, every branch is expanded so matches are visible. */
  forceExpanded: boolean
}

export function TaskListView({ nodes, onOpen, forceExpanded }: TaskListViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <ul
      role="tree"
      aria-label="Tasks"
      className="flex flex-col overflow-hidden rounded-(--radius-panel) border border-rule bg-surface p-1 shadow-(--shadow-hairline)"
    >
      {nodes.map((node) => (
        <TaskRow key={node.task.id} node={node} depth={0} onOpen={onOpen} collapsed={forceExpanded ? new Set() : collapsed} onToggle={toggle} />
      ))}
    </ul>
  )
}

interface TaskRowProps {
  node: TaskNode
  depth: number
  onOpen: (task: Task) => void
  collapsed: Set<string>
  onToggle: (id: string) => void
}

function TaskRow({ node, depth, onOpen, collapsed, onToggle }: TaskRowProps) {
  const { task, children, progress } = node
  const { update } = useTaskMutations()
  const { isAdmin } = useWorkspace()
  const hasChildren = children.length > 0
  const expanded = hasChildren && !collapsed.has(task.id)
  const done = task.status === 'done'

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={false}>
      <div
        className="group flex min-h-[var(--density-row)] items-center gap-1 rounded-(--radius-control) pr-2 transition-colors hover:bg-sunken"
        style={{ paddingLeft: depth * 22 }}
      >
        <span className="grid size-6 shrink-0 place-items-center">
          {hasChildren && (
            <button
              type="button"
              onClick={() => onToggle(task.id)}
              aria-label={expanded ? `Collapse "${task.title}"` : `Expand "${task.title}"`}
              className="grid size-6 cursor-pointer place-items-center rounded text-ink-3 hover:bg-rule hover:text-ink"
            >
              <CaretRight aria-hidden size={12} weight="bold" className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />
            </button>
          )}
        </span>

        <StatusCircle
          status={task.status}
          title={task.title}
          onToggle={() => update.mutate({ id: task.id, changes: { status: done ? 'todo' : 'done' } })}
        />

        <button
          type="button"
          onClick={() => onOpen(task)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          aria-label={`Open "${task.title}"${isAdmin ? ' to edit' : ''}`}
        >
          <span
            className={`truncate text-[15px] transition-colors ${
              done ? 'text-ink-3 line-through decoration-ink-3/60' : depth === 0 && hasChildren ? 'font-medium text-ink' : 'text-ink'
            }`}
          >
            {task.title}
          </span>
          {task.source === 'agent' && <AgentBadge />}
        </button>

        <span className="hidden items-center gap-4 sm:flex">
          <Progress {...progress} />
          <span className="w-16 text-right">
            <DueDate task={task} compact />
          </span>
        </span>
        <PriorityIcon priority={task.priority} className="ml-2" />
        <span className="ml-2">
          <Assignee person={task.assignee} />
        </span>
      </div>

      {expanded && (
        <ul role="group" className="flex flex-col">
          {children.map((child) => (
            <TaskRow key={child.task.id} node={child} depth={depth + 1} onOpen={onOpen} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  )
}
