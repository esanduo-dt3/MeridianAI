import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AuditEntry,
  Note,
  NoteSummary,
  PipelineHealth,
  ReviewQueue,
} from '../lib/types'
import { NotesPage } from '../routes/NotesPage'
import { AuditLogPage } from '../routes/admin/AuditLogPage'
import { PipelineHealthPage } from '../routes/admin/PipelineHealthPage'
import { ReviewQueuePage } from '../routes/admin/ReviewQueuePage'

const continuityState = vi.hoisted(() => ({
  isAdmin: true,
}))

const noteSummary: NoteSummary = {
  id: 'note-1',
  title: 'Release continuity',
  preview: 'Preserve visible save state.',
  created_at: '2026-09-18T09:00:00.000Z',
  updated_at: '2026-09-18T10:00:00.000Z',
  created_by: {
    id: 'user-1',
    email: 'admin@meridian.test',
    full_name: 'Avery Admin',
    avatar_url: null,
  },
}

const noteFixture: Note = {
  ...noteSummary,
  content: { type: 'doc', content: [] },
}

const reviewFixture: ReviewQueue = {
  answers: [],
  actions: [
    {
      id: 'action-1',
      action_type: 'create_task',
      reasoning: 'The approved release checklist requires follow-up.',
      proposed_payload: {
        title: 'Complete release review',
        priority: 'high',
      },
      created_at: '2026-09-18T10:00:00.000Z',
    },
  ],
  recent: [
    {
      kind: 'action',
      target_id: 'action-0',
      decision: 'approved',
      notes: null,
      correction: null,
      at: '2026-09-18T09:00:00.000Z',
      summary: 'Archive prior evidence',
      by: 'Avery Admin',
    },
  ],
}

const auditFixture: AuditEntry = {
  id: 'audit-1',
  actor_type: 'user',
  action: 'answer.reviewed',
  target_type: 'answer',
  target_id: 'answer-1',
  timestamp: '2026-09-18T10:00:00.000Z',
  details: { decision: 'confirmed', evidence: 'citation-1' },
  actor: {
    email: 'admin@meridian.test',
    full_name: 'Avery Admin',
  },
}

const healthFixture: PipelineHealth = {
  window: { days: 30, from: '2026-08-20', to: '2026-09-18' },
  questions: 10,
  answers: 8,
  retrieval_graded_good: { hits: 7, n: 10, rate: 0.7 },
  groundedness_passed: { hits: 6, n: 8, rate: 0.75 },
  flagged: { hits: 2, n: 8, rate: 0.25 },
  retried: { hits: 3, n: 10, rate: 0.3 },
  rerank_unavailable: { hits: 1, n: 10, rate: 0.1 },
  latency_ms: { p50: 1400, p95: 3000, max: 4100, n: 10, target_p50: 2000 },
  flag_reasons: { low_confidence: 2 },
  models: { 'test-model': 8 },
  profiles: { balanced: 10 },
  by_day: [
    {
      date: '2026-09-18',
      questions: 4,
      graded_good: { hits: 3, n: 4, rate: 0.75 },
      groundedness_passed: { hits: 2, n: 3, rate: 2 / 3 },
      flagged: { hits: 1, n: 3, rate: 1 / 3 },
      latency_p50_ms: 1200,
    },
  ],
}

vi.mock('../workspace/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    isAdmin: continuityState.isAdmin,
    active: { id: 'workspace-1', name: 'Meridian Test' },
  }),
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@meridian.test' },
  }),
}))

vi.mock('../notes/useNotes', () => ({
  useNotesList: () => ({
    data: [noteSummary],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useNote: () => ({
    data: noteFixture,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useNoteMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    save: { mutateAsync: vi.fn() },
    remove: {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    },
  }),
}))

vi.mock('../notes/NoteEditor', () => ({
  NoteEditor: ({
    note,
    onStateChange,
  }: {
    note: Note
    onStateChange: (state: 'saved' | 'saving' | 'unsaved' | 'error') => void
  }) => (
    <section aria-label="Note editor">
      <h2>{note.title}</h2>
      <button type="button" onClick={() => onStateChange('saving')}>
        Simulate save
      </button>
    </section>
  ),
}))

vi.mock('../admin/useAdmin', () => ({
  useReviewQueue: () => ({
    data: reviewFixture,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useReviewMutations: () => ({
    reviewAnswer: {
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    },
    decideAction: {
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    },
  }),
  useAuditLog: () => ({
    data: { pages: [{ entries: [auditFixture], next_before: null }] },
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
  usePipelineHealth: () => ({
    data: healthFixture,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.includes('/notes/') ? '/notes/:noteId' : path} element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('note continuity', () => {
  it('retains selected-note context, a mobile return path, and visible save state', async () => {
    const user = userEvent.setup()
    renderAt('/notes/note-1', <NotesPage />)

    expect(screen.getByRole('link', { name: /^Release continuity/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Notes' })).toHaveClass('lg:hidden')
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByRole('region', { name: 'Note editor' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simulate save' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')
  })
})

describe('administrator evidence surfaces', () => {
  beforeEach(() => {
    continuityState.isAdmin = true
  })

  it('explains protected administration to Members without rendering review controls', () => {
    continuityState.isAdmin = false
    renderAt('/admin/review', <ReviewQueuePage />)

    expect(screen.getByRole('heading', { name: 'Only Admins can see this page' })).toBeInTheDocument()
    expect(screen.getByText(/You're a Member of Meridian Test/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('retains human-decision and pending proposal wording for administrators', () => {
    renderAt('/admin/review', <ReviewQueuePage />)

    expect(screen.getByText('Human decision required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Proposed actions/ })).toHaveTextContent('1')
    expect(screen.getByText('Agent proposal', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByText(/Avery Admin/)).toBeInTheDocument()
  })

  it('shows attributable audit evidence and inspectable recorded details', async () => {
    const user = userEvent.setup()
    renderAt('/admin/audit', <AuditLogPage />)

    expect(screen.getByText('Person')).toBeInTheDocument()
    expect(screen.getByText('answer.reviewed')).toBeInTheDocument()
    expect(screen.getByText('Avery Admin')).toBeInTheDocument()

    await user.click(screen.getByText('answer.reviewed'))
    expect(screen.getByText('target answer-1')).toBeInTheDocument()
    expect(screen.getByText(/"decision": "confirmed"/)).toBeInTheDocument()
  })

  it('shows the real numerator and denominator behind health rates and bounds the wide table', () => {
    renderAt('/admin/health', <PipelineHealthPage />)

    const retrievalTile = screen.getByText('Retrieval graded good').parentElement
    expect(retrievalTile).not.toBeNull()
    expect(within(retrievalTile!).getByText('70%')).toBeInTheDocument()
    expect(within(retrievalTile!).getByText('7 of 10 runs')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Pipeline figures per day' })
    expect(table.parentElement).toHaveClass('bounded-overflow')
    expect(within(table).getByText('(3/4)')).toBeInTheDocument()
    expect(screen.getByText('Recorded data only')).toBeInTheDocument()
  })
})
