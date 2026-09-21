import { useMemo, useState, type ReactNode } from 'react'
import {
  closestCorners,
  DndContext,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowElbowDownRight } from '@phosphor-icons/react'
import type { Task, TaskStatus } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { QuickAdd } from './QuickAdd'
import { AgentBadge, Assignee, DueDate, PriorityIcon, Progress, StatusCircle } from './TaskBits'
import { positionBetween, STATUSES, statusLabel } from './taskModel'
import { useTaskMutations } from './useTasks'

type Columns = Record<TaskStatus, string[]>

interface TaskBoardViewProps {
  tasks: Task[]
  allTasks: Task[]
  onOpen: (task: Task) => void
}

const isStatus = (id: UniqueIdentifier): id is TaskStatus => STATUSES.some((s) => s.value === id)

/*
  Prefer whatever is under the pointer: a card, or the column's empty space.
  closestCorners alone compares corner distances, so once a column is taller
  than the screen its far-away corners lose to cards in the column you started
  in, and cross-column drops silently fail. Keyboard drags have no pointer and
  fall back to closestCorners.
*/
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : closestCorners(args)
}

export function TaskBoardView({ tasks, allTasks, onOpen }: TaskBoardViewProps) {
  const { update } = useTaskMutations()
  const { isAdmin } = useWorkspace()
  const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks])

  const baseColumns = useMemo<Columns>(() => {
    const columns: Columns = { todo: [], in_progress: [], done: [] }
    ;[...tasks].sort((a, b) => a.position - b.position).forEach((t) => columns[t.status].push(t.id))
    return columns
  }, [tasks])

  // Subtask progress for cards: direct children across all tasks, not just visible ones.
  const progressOf = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const t of allTasks) {
      if (!t.parent_task_id) continue
      const entry = map.get(t.parent_task_id) ?? { done: 0, total: 0 }
      entry.total += 1
      if (t.status === 'done') entry.done += 1
      map.set(t.parent_task_id, entry)
    }
    return map
  }, [allTasks])

  const [dragColumns, setDragColumns] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const columns = dragColumns ?? baseColumns

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const containerOf = (id: UniqueIdentifier, cols: Columns): TaskStatus | undefined =>
    isStatus(id) ? id : (Object.keys(cols) as TaskStatus[]).find((status) => cols[status].includes(String(id)))

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
    setDragColumns(baseColumns)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragColumns) return
    const from = containerOf(active.id, dragColumns)
    const to = containerOf(over.id, dragColumns)
    if (!from || !to || from === to) return
    setDragColumns((cols) => {
      if (!cols) return cols
      const target = cols[to]
      const overIndex = isStatus(over.id) ? target.length : target.indexOf(String(over.id))
      return {
        ...cols,
        [from]: cols[from].filter((id) => id !== active.id),
        [to]: [...target.slice(0, overIndex), String(active.id), ...target.slice(overIndex)],
      }
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const cols = dragColumns
    setActiveId(null)
    setDragColumns(null)
    if (!over || !cols) return

    const to = containerOf(over.id, cols)
    if (!to) return
    let list = cols[to]
    const oldIndex = list.indexOf(String(active.id))
    const overIndex = isStatus(over.id) ? list.length - 1 : list.indexOf(String(over.id))
    if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) list = arrayMove(list, oldIndex, overIndex)

    const index = list.indexOf(String(active.id))
    const task = byId.get(String(active.id))
    if (!task || index === -1) return
    const before = index > 0 ? byId.get(list[index - 1]!)?.position : undefined
    const after = index < list.length - 1 ? byId.get(list[index + 1]!)?.position : undefined
    const position = positionBetween(before, after)

    if (task.status === to && list.join() === baseColumns[to].join()) return
    update.mutate({ id: task.id, changes: task.status === to ? { position } : { status: to, position } })
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up "${byId.get(String(active.id))?.title}".`,
    onDragOver: ({ active, over }) =>
      over && dragColumns
        ? `"${byId.get(String(active.id))?.title}" is over ${statusLabel(containerOf(over.id, dragColumns) ?? 'todo')}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over && dragColumns
        ? `Dropped "${byId.get(String(active.id))?.title}" in ${statusLabel(containerOf(over.id, dragColumns) ?? 'todo')}.`
        : `Dropped "${byId.get(String(active.id))?.title}".`,
    onDragCancel: ({ active }) => `Cancelled moving "${byId.get(String(active.id))?.title}".`,
  }

  const activeTask = activeId ? byId.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragColumns(null)
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'To move a task, press Space or Enter, use the arrow keys to choose a column and position, then press Space or Enter again. Press Escape to cancel. Press O to open the task.',
        },
      }}
    >
      <div className="bounded-overflow rounded-(--radius-panel) border border-rule bg-surface p-3 pb-4">
        <div className="grid min-w-[760px] grid-cols-3 gap-3">
          {STATUSES.map(({ value, label }) => (
            <BoardColumn key={value} status={value} label={label} ids={columns[value]} count={columns[value].length}>
              {columns[value].map((id) => {
                const task = byId.get(id)
                return task ? (
                  <SortableCard
                    key={id}
                    task={task}
                    parent={task.parent_task_id ? byId.get(task.parent_task_id) : undefined}
                    progress={progressOf.get(id)}
                    onOpen={onOpen}
                  />
                ) : null
              })}
              {isAdmin && <QuickAdd status={value} label="Add task" className="mt-1" />}
            </BoardColumn>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {activeTask ? (
          <Card
            task={activeTask}
            parent={activeTask.parent_task_id ? byId.get(activeTask.parent_task_id) : undefined}
            progress={progressOf.get(activeTask.id)}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function BoardColumn({ status, label, ids, count, children }: { status: TaskStatus; label: string; ids: string[]; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section aria-label={`${label}, ${count} ${count === 1 ? 'task' : 'tasks'}`} className="flex min-w-0 flex-col">
      <header className="mb-2 flex items-center gap-2 px-1">
        <StatusCircle status={status} title={label} size={14} />
        <h2 className="text-sm font-medium text-ink">{label}</h2>
        <span className="font-mono text-xs text-ink-3 tabular">{count}</span>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-40 flex-1 flex-col gap-2 rounded-(--radius-control) border p-2 transition-colors duration-150 ${
            isOver ? 'border-cobalt/50 bg-cobalt-wash/40' : 'border-rule bg-sunken/50'
          }`}
        >
          {children}
          {count === 0 && <p className="px-2 py-6 text-center text-sm text-ink-3">Drop tasks here</p>}
        </div>
      </SortableContext>
    </section>
  )
}

interface CardProps {
  task: Task
  parent?: Task
  progress?: { done: number; total: number }
  onOpen?: (task: Task) => void
  dragging?: boolean
}

function SortableCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : undefined}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
      aria-label={`${props.task.title}. ${statusLabel(props.task.status)}.`}
    >
      <Card {...props} />
    </div>
  )
}

function Card({ task, parent, progress, onOpen, dragging }: CardProps) {
  const done = task.status === 'done'
  return (
    <article
      onClick={() => onOpen?.(task)}
      onKeyDown={(event) => {
        if (event.key === 'o' || event.key === 'O') onOpen?.(task)
      }}
      className={`group cursor-grab rounded-(--radius-control) border border-rule bg-surface p-3 text-left shadow-(--shadow-hairline) transition-[border-color,box-shadow] duration-150 hover:border-rule-strong active:cursor-grabbing ${
        dragging ? 'rotate-[1.5deg] cursor-grabbing border-rule-strong shadow-(--shadow-lift)' : ''
      }`}
    >
      {parent && (
        <p className="mb-1 flex min-w-0 items-center gap-1 text-xs text-ink-3">
          <ArrowElbowDownRight aria-hidden size={12} weight="bold" className="shrink-0" />
          <span className="truncate">{parent.title}</span>
        </p>
      )}
      <p className={`text-[14.5px] leading-snug ${done ? 'text-ink-3 line-through decoration-ink-3/60' : 'text-ink'}`}>{task.title}</p>
      <div className="mt-3 flex items-center gap-2">
        <PriorityIcon priority={task.priority} />
        <DueDate task={task} />
        {progress && <Progress {...progress} />}
        {task.source === 'agent' && <AgentBadge />}
        <span className="ml-auto">
          <Assignee person={task.assignee} size={22} />
        </span>
      </div>
    </article>
  )
}
