import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowsDownUp,
  CaretDown,
  CheckSquareOffset,
  Kanban,
  MagnifyingGlass,
  TreeStructure,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { errorText } from '../lib/queryClient'
import type { Priority, Task } from '../lib/types'
import { ProposalsPanel } from '../tasks/ProposalsPanel'
import { QuickAdd } from '../tasks/QuickAdd'
import { SprintBar } from '../tasks/SprintBar'
import { TaskBoardView } from '../tasks/TaskBoardView'
import { TaskCommandBar } from '../tasks/TaskCommandBar'
import { TaskDrawer } from '../tasks/TaskDrawer'
import { TaskListView } from '../tasks/TaskListView'
import { useSprints } from '../tasks/useSprints'
import { buildTree, filterTasks, scopeTasks, type Scope } from '../tasks/taskModel'
import { useTaskBoard } from '../tasks/useTasks'
import { useWorkspace } from '../workspace/WorkspaceProvider'

type View = 'list' | 'board'

const VIEWS: { value: View; label: string; icon: Icon }[] = [
  { value: 'list', label: 'List', icon: TreeStructure },
  { value: 'board', label: 'Board', icon: Kanban },
]

/** Presentation-only ordering of the list view over already-loaded tasks. */
type SortKey = 'manual' | 'priority' | 'due' | 'updated'

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'manual', label: 'Manual order' },
  { value: 'priority', label: 'Priority' },
  { value: 'due', label: 'Due date' },
  { value: 'updated', label: 'Recently updated' },
]

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }

/*
  Comparators run on the client over the tasks already in the board payload, so no query key,
  request or server field changes. Undated tasks sort last rather than first, which is why the
  missing due date maps to a sentinel that is larger than any real ISO date.
*/
const COMPARATORS: Record<Exclude<SortKey, 'manual'>, (a: Task, b: Task) => number> = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  due: (a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'),
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
}

// PUBLIC_INTERFACE
export function TasksPage() {
  /** Renders the URL-backed task workspace in list or board form without changing task domain behavior. */
  const { active, isAdmin } = useWorkspace()
  const board = useTaskBoard()
  const sprints = useSprints()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'board' ? 'board' : 'list'
  // Which slice of the work is on screen: all of it, the backlog, or one sprint (D-048).
  const scope: Scope = params.get('sprint') ?? 'all'
  const openId = params.get('task')
  const [query, setQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(true)
  const [sort, setSort] = useState<SortKey>('manual')
  const searchRef = useRef<HTMLInputElement>(null)

  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: key === 'view' },
    )

  // "/" focuses the filter, as in most tools.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || target.closest('input, textarea, select, [contenteditable=true], [role=dialog]')) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const allTasks = useMemo(() => board.data?.tasks ?? [], [board.data])
  const tasks = useMemo(() => scopeTasks(allTasks, scope), [allTasks, scope])
  const visible = useMemo(() => filterTasks(tasks, query, showCompleted), [tasks, query, showCompleted])
  const tree = useMemo(() => {
    const nodes = buildTree(visible)
    // Subtask order stays with buildTree; only the top level is reordered, so hierarchy is intact.
    if (sort === 'manual') return nodes
    const compare = COMPARATORS[sort]
    return [...nodes].sort((a, b) => compare(a.task, b.task))
  }, [visible, sort])
  const openTask = openId ? (allTasks.find((task) => task.id === openId) ?? null) : null
  const openCount = tasks.filter((task) => task.status !== 'done').length
  const doneCount = tasks.length - openCount
  const filtering = query.trim().length > 0
  const onOpen = (task: Task) => setParam('task', task.id)

  const viewTabs = (
    <div role="tablist" aria-label="View" className="inline-flex gap-0.5 rounded-(--radius-control) border border-rule bg-sunken p-0.5">
      {VIEWS.map(({ value, label, icon: Glyph }) => (
        <button
          key={value}
          role="tab"
          type="button"
          aria-selected={view === value}
          onClick={() => setParam('view', value === 'list' ? null : value)}
          className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-sm transition-colors ${
            view === value ? 'bg-surface font-medium text-ink shadow-(--shadow-hairline)' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Glyph aria-hidden size={16} weight={view === value ? 'bold' : 'regular'} />
          {label}
        </button>
      ))}
    </div>
  )

  const filterField = (
    <div className="relative w-[min(18rem,calc(100vw-5rem))] shrink-0">
      <MagnifyingGlass
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
      />
      <label htmlFor="task-filter" className="sr-only">
        Filter tasks
      </label>
      <input
        id="task-filter"
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by title or assignee"
        className="min-h-10 w-full rounded-(--radius-control) border border-rule bg-paper pr-9 pl-9 text-sm text-ink placeholder:text-ink-3 hover:border-rule-strong focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-mono text-[11px] text-ink-3">
        /
      </kbd>
    </div>
  )

  const completedToggle = (
    <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-ink-2 select-none">
      <input
        type="checkbox"
        checked={showCompleted}
        onChange={(event) => setShowCompleted(event.target.checked)}
        className="size-4 cursor-pointer accent-(--color-cobalt)"
      />
      Show completed
    </label>
  )

  // Sorting reorders the list view only; the board keeps its own column ordering.
  const sortControl =
    view === 'list' ? (
      <div className="relative shrink-0">
        <label htmlFor="task-sort" className="sr-only">
          Sort tasks
        </label>
        <ArrowsDownUp aria-hidden size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <select
          id="task-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          className="min-h-10 cursor-pointer appearance-none rounded-(--radius-control) border border-rule bg-paper pr-8 pl-9 text-sm text-ink hover:border-rule-strong focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none"
        >
          {SORTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <CaretDown aria-hidden size={13} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-4">
      <TaskCommandBar
        title="Tasks"
        workspaceName={active?.name}
        openCount={openCount}
        doneCount={doneCount}
        showCounts={board.isSuccess}
        viewTabs={viewTabs}
        filterField={filterField}
        completedToggle={completedToggle}
        sortControl={sortControl}
        sprintScope={
          <SprintBar
            board={sprints.data}
            tasks={allTasks}
            scope={scope}
            onScope={(next) => setParam('sprint', next === 'all' ? null : next)}
            canManage={isAdmin}
          />
        }
        matchSummary={
          filtering ? (
            <span className="whitespace-nowrap">
              Showing <span className="tabular">{visible.length}</span> of <span className="tabular">{tasks.length}</span>
            </span>
          ) : undefined
        }
        permissionHint={
          !isAdmin ? (
            <span className="whitespace-nowrap">You can change task status. Admins add and edit tasks.</span>
          ) : undefined
        }
      />

      {board.isPending ? (
        <TasksSkeleton view={view} />
      ) : board.isError ? (
        <ErrorState title="Tasks couldn't be loaded" message={errorText(board.error)} onRetry={() => void board.refetch()} />
      ) : (
        <>
          <ProposalsPanel proposals={board.data.proposals} />

          {tasks.length === 0 ? (
            <div className="flex flex-col gap-3">
              {scope === 'all' ? (
                <EmptyState icon={CheckSquareOffset} title="No tasks yet">
                  {isAdmin
                    ? 'Add the first task below, or press N. Agent suggestions appear above for your approval.'
                    : 'When an Admin adds tasks, or approves one the agent suggests, they appear here.'}
                </EmptyState>
              ) : (
                <EmptyState
                  icon={CheckSquareOffset}
                  title="Nothing in this view"
                  action={
                    <Button variant="secondary" onClick={() => setParam('sprint', null)}>
                      Show all work
                    </Button>
                  }
                >
                  {scope === 'backlog'
                    ? 'Every task belongs to a sprint right now, so the backlog is empty.'
                    : 'This sprint has no tasks yet. Move tasks into it from the backlog, or switch back to all work.'}
                </EmptyState>
              )}
              {isAdmin && <QuickAdd shortcut />}
            </div>
          ) : view === 'list' ? (
            <div className="flex flex-col">
              {tree.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-dashed border-rule-strong px-5 py-8 text-center">
                  <p className="text-sm text-ink-2">
                    {filtering
                      ? `No tasks match "${query}".`
                      : 'Every task in this view is completed, and completed tasks are hidden.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {filtering && (
                      <Button variant="secondary" onClick={() => setQuery('')}>
                        Clear filter
                      </Button>
                    )}
                    {!showCompleted && (
                      <Button variant="ghost" onClick={() => setShowCompleted(true)}>
                        Show completed
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <TaskListView nodes={tree} onOpen={onOpen} forceExpanded={filtering} />
              )}
              {isAdmin && <QuickAdd shortcut className="mt-2" />}
            </div>
          ) : (
            <TaskBoardView tasks={visible} allTasks={tasks} onOpen={onOpen} />
          )}
        </>
      )}

      <TaskDrawer task={openTask} allTasks={allTasks} onClose={() => setParam('task', null)} onOpen={onOpen} />
    </div>
  )
}

function TasksSkeleton({ view }: { view: View }) {
  if (view === 'board') {
    return (
      <div className="grid grid-cols-3 gap-4" role="status" aria-label="Loading tasks">
        {[0, 1, 2].map((column) => (
          <div key={column} className="flex flex-col gap-2 rounded-(--radius-panel) border border-rule p-2">
            <Skeleton className="h-4 w-20" />
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading tasks">
      {[72, 55, 64, 40, 58].map((width, index) => (
        <div key={index} className="flex items-center gap-3" style={{ paddingLeft: index % 3 === 1 ? 28 : 0 }}>
          <Skeleton className="size-[18px] rounded-full" />
          <span aria-hidden className="block h-4 animate-pulse rounded-md bg-sunken" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}
