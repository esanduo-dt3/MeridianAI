import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../lib/types'
import { TasksPage } from '../routes/TasksPage'

const taskState = vi.hoisted(() => ({
  isAdmin: true,
  create: vi.fn(),
  task: {
    id: 'task-1',
    title: 'Verify workspace hierarchy',
    description: 'Protect URL state and role boundaries.',
    status: 'todo',
    priority: 'high',
    position: 1,
    parent_task_id: null,
    sprint_id: 'sprint-1',
    due_date: null,
    source: 'manual',
    created_at: '2026-09-18T10:00:00.000Z',
    updated_at: '2026-09-18T10:00:00.000Z',
    completed_at: null,
    assignee: null,
    created_by: null,
  } satisfies Task,
}))

vi.mock('../workspace/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    active: { id: 'workspace-1', name: 'Meridian Test' },
    isAdmin: taskState.isAdmin,
  }),
}))

vi.mock('../tasks/useTasks', () => ({
  useTaskBoard: () => ({
    data: { tasks: [taskState.task], proposals: [] },
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useTaskMutations: () => ({
    create: { mutate: taskState.create, isPending: false },
  }),
}))

vi.mock('../tasks/useSprints', () => ({
  useSprints: () => ({
    data: {
      active_sprint_id: 'sprint-1',
      sprints: [
        {
          id: 'sprint-1',
          name: 'September',
          start_date: null,
          end_date: null,
          status: 'active',
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ],
    },
    isPending: false,
  }),
}))

vi.mock('../tasks/ProposalsPanel', () => ({
  ProposalsPanel: () => <p>Proposal evidence</p>,
}))

vi.mock('../tasks/SprintBar', () => ({
  SprintBar: ({
    scope,
    onScope,
    canManage,
  }: {
    scope: string
    onScope: (scope: string) => void
    canManage: boolean
  }) => (
    <section aria-label="Sprint context">
      <span>Scope: {scope}</span>
      <span>{canManage ? 'Sprint controls available' : 'Sprint controls protected'}</span>
      <button type="button" onClick={() => onScope('sprint-1')}>
        Focus September
      </button>
    </section>
  ),
}))

vi.mock('../tasks/TaskListView', () => ({
  TaskListView: ({ onOpen }: { onOpen: (task: Task) => void }) => (
    <button type="button" onClick={() => onOpen(taskState.task)}>
      Open Verify workspace hierarchy
    </button>
  ),
}))

vi.mock('../tasks/TaskBoardView', () => ({
  TaskBoardView: ({ onOpen }: { onOpen: (task: Task) => void }) => (
    <section aria-label="Task board">
      <button type="button" onClick={() => onOpen(taskState.task)}>
        Open board task
      </button>
    </section>
  ),
}))

vi.mock('../tasks/TaskDrawer', () => ({
  TaskDrawer: ({
    task,
    onClose,
  }: {
    task: Task | null
    onClose: () => void
  }) =>
    task ? (
      <section role="dialog" aria-label={task.title}>
        <button type="button" onClick={onClose}>
          Close task
        </button>
      </section>
    ) : null,
}))

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Current location">{`${location.pathname}${location.search}`}</output>
}

function renderTasks(entry = '/tasks') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/tasks"
          element={
            <>
              <TasksPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Tasks workspace regression contracts', () => {
  beforeEach(() => {
    taskState.isAdmin = true
    taskState.create.mockReset()
  })

  it('preserves view and sprint URL context while switching views', async () => {
    const user = userEvent.setup()
    renderTasks('/tasks?view=board&sprint=sprint-1')

    expect(screen.getByRole('tab', { name: 'Board' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Task board' })).toBeInTheDocument()
    expect(screen.getByText('Scope: sprint-1')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'List' }))

    expect(screen.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/tasks?sprint=sprint-1')
  })

  it('writes sprint and selected-task context to the URL and removes only the closed task', async () => {
    const user = userEvent.setup()
    renderTasks()

    await user.click(screen.getByRole('button', { name: 'Focus September' }))
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/tasks?sprint=sprint-1')

    await user.click(screen.getByRole('button', { name: 'Open Verify workspace hierarchy' }))
    expect(screen.getByRole('dialog', { name: 'Verify workspace hierarchy' })).toBeInTheDocument()
    expect(screen.getByLabelText('Current location')).toHaveTextContent('sprint=sprint-1&task=task-1')

    await user.click(screen.getByRole('button', { name: 'Close task' }))
    expect(screen.queryByRole('dialog', { name: 'Verify workspace hierarchy' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Current location')).toHaveTextContent('/tasks?sprint=sprint-1')
  })

  it('focuses task search with slash and opens the Admin quick composer with N', async () => {
    const user = userEvent.setup()
    renderTasks()

    await user.keyboard('/')
    const search = screen.getByRole('searchbox', { name: 'Filter tasks' })
    expect(search).toHaveFocus()

    search.blur()
    await user.keyboard('n')
    const title = screen.getByRole('textbox', { name: 'New task title' })
    await waitFor(() => expect(title).toHaveFocus())
  })

  it('retains Member guidance and hides task and sprint creation controls', () => {
    taskState.isAdmin = false
    renderTasks()

    expect(screen.getByText('You can change task status. Admins add and edit tasks.')).toBeInTheDocument()
    expect(screen.getByText('Sprint controls protected')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Shortcut: N')).not.toBeInTheDocument()
  })
})
