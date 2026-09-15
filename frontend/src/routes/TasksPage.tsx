import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckSquareOffset, Kanban, MagnifyingGlass, TreeStructure, type Icon } from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { errorText } from '../lib/queryClient'
import type { Task } from '../lib/types'
import { ProposalsPanel } from '../tasks/ProposalsPanel'
import { QuickAdd } from '../tasks/QuickAdd'
import { TaskBoardView } from '../tasks/TaskBoardView'
import { TaskDrawer } from '../tasks/TaskDrawer'
import { TaskListView } from '../tasks/TaskListView'
import { buildTree, filterTasks } from '../tasks/taskModel'
import { useTaskBoard } from '../tasks/useTasks'
import { useWorkspace } from '../workspace/WorkspaceProvider'

type View = 'list' | 'board'

const VIEWS: { value: View; label: string; icon: Icon }[] = [
  { value: 'list', label: 'List', icon: TreeStructure },
  { value: 'board', label: 'Board', icon: Kanban },
]

export function TasksPage() {
  const { active, isAdmin } = useWorkspace()
  const board = useTaskBoard()
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'board' ? 'board' : 'list'
  const openId = params.get('task')
  const [query, setQuery] = useState('')
  const [showCompleted, setShowCompleted] = useState(true)
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

  const tasks = useMemo(() => board.data?.tasks ?? [], [board.data])
  const visible = useMemo(() => filterTasks(tasks, query, showCompleted), [tasks, query, showCompleted])
  const tree = useMemo(() => buildTree(visible), [visible])
  const openTask = openId ? (tasks.find((t) => t.id === openId) ?? null) : null
  const openCount = tasks.filter((t) => t.status !== 'done').length
  const doneCount = tasks.length - openCount
  const onOpen = (task: Task) => setParam('task', task.id)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-rule pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">Tasks</h1>
            <p className="mt-1 text-[15px] text-ink-2">
              {board.isSuccess ? (
                <>
                  <span className="font-medium text-ink tabular">{openCount}</span> open ·{' '}
                  <span className="font-medium text-ink tabular">{doneCount}</span> done in {active?.name}
                </>
              ) : (
                <>Everything planned in {active?.name}.</>
              )}
            </p>
          </div>

          <div role="tablist" aria-label="View" className="inline-flex gap-0.5 rounded-(--radius-control) border border-rule bg-sunken p-0.5">
            {VIEWS.map(({ value, label, icon: Glyph }) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={view === value}
                onClick={() => setParam('view', value === 'list' ? null : value)}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-sm transition-colors ${
                  view === value ? 'bg-surface font-medium text-ink shadow-(--shadow-hairline)' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Glyph aria-hidden size={16} weight={view === value ? 'bold' : 'regular'} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlass aria-hidden size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
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
              className="min-h-10 w-full rounded-(--radius-control) border border-rule bg-surface pr-9 pl-9 text-sm text-ink placeholder:text-ink-3 hover:border-rule-strong focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-rule px-1.5 font-mono text-[11px] text-ink-3">/</kbd>
          </div>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink-2 select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
              className="size-4 cursor-pointer accent-(--color-cobalt)"
            />
            Show completed
          </label>
          {!isAdmin && <p className="text-sm text-ink-3 sm:ml-auto">You can change task status. Admins add and edit tasks.</p>}
        </div>
      </header>

      {board.isPending ? (
        <TasksSkeleton view={view} />
      ) : board.isError ? (
        <ErrorState title="Tasks couldn't be loaded" message={errorText(board.error)} onRetry={() => void board.refetch()} />
      ) : (
        <>
          <ProposalsPanel proposals={board.data.proposals} />

          {tasks.length === 0 ? (
            <div className="flex flex-col gap-3">
              <EmptyState icon={CheckSquareOffset} title="No tasks yet">
                {isAdmin
                  ? 'Add the first task below, or press N. Agent suggestions appear above for your approval.'
                  : 'When an Admin adds tasks, or approves one the agent suggests, they appear here.'}
              </EmptyState>
              {isAdmin && <QuickAdd shortcut />}
            </div>
          ) : view === 'list' ? (
            <div className="flex flex-col">
              {tree.length === 0 ? (
                <p className="rounded-(--radius-panel) border border-dashed border-rule-strong px-5 py-8 text-center text-sm text-ink-2">
                  No tasks match{query ? ` "${query}"` : ''}. {!showCompleted && 'Completed tasks are hidden.'}
                </p>
              ) : (
                <TaskListView nodes={tree} onOpen={onOpen} forceExpanded={query.trim().length > 0} />
              )}
              {isAdmin && <QuickAdd shortcut className="mt-2" />}
            </div>
          ) : (
            <TaskBoardView tasks={visible} allTasks={tasks} onOpen={onOpen} />
          )}
        </>
      )}

      <TaskDrawer task={openTask} allTasks={tasks} onClose={() => setParam('task', null)} onOpen={onOpen} />
    </div>
  )
}

function TasksSkeleton({ view }: { view: View }) {
  if (view === 'board') {
    return (
      <div className="grid grid-cols-3 gap-4" role="status" aria-label="Loading tasks">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex flex-col gap-2 rounded-(--radius-panel) border border-rule p-2">
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
      {[72, 55, 64, 40, 58].map((width, i) => (
        <div key={i} className="flex items-center gap-3" style={{ paddingLeft: i % 3 === 1 ? 28 : 0 }}>
          <Skeleton className="size-[18px] rounded-full" />
          <span aria-hidden className="block h-4 animate-pulse rounded-md bg-sunken" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}
