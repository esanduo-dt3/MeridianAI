import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Inspector, InspectorClose } from '../components/Inspector'
import { AppShell } from '../layouts/AppShell'
import { PageFrame, type PageFrameMode } from '../layouts/PageFrame'

const shellState = vi.hoisted(() => ({
  isAdmin: true,
}))

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { email: 'admin@meridian.test', user_metadata: { full_name: 'Avery Admin' } },
    signOut: vi.fn(),
  }),
}))

vi.mock('../workspace/WorkspaceProvider', () => ({
  useWorkspace: () => ({
    isAdmin: shellState.isAdmin,
    active: { id: 'workspace-1', name: 'Meridian Test' },
    profile: {
      email: 'admin@meridian.test',
      full_name: 'Avery Admin',
      avatar_url: null,
    },
  }),
}))

vi.mock('../workspace/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => <button type="button">Meridian Test</button>,
}))

vi.mock('../theme/ThemeToggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}))

vi.mock('../components/Wordmark', () => ({
  Wordmark: () => <span>MeridianAI</span>,
}))

vi.mock('../components/ReliabilityNote', () => ({
  ReliabilityNote: () => <p>Answers cite workspace passages.</p>,
}))

vi.mock('../components/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <span aria-label={`${name} avatar`} />,
}))

function renderShell(initialEntry = '/tasks') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/tasks" element={<h1>Task workspace</h1>} />
          <Route path="/assistant" element={<h1>Assistant workspace</h1>} />
          <Route path="/notes" element={<h1>Notes workspace</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function InspectorHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Inspect task
      </button>
      <Inspector
        open={open}
        onOpenChange={setOpen}
        title="Task details"
        description="Inspect the selected task."
        width="lg"
      >
        <header>
          <InspectorClose />
        </header>
        <p>Selected task evidence</p>
      </Inspector>
    </>
  )
}

describe('route-owned page frames', () => {
  it.each([
    ['reading', 'max-w-[var(--frame-reading)]'],
    ['operational', 'max-w-[var(--frame-operational)]'],
    ['split', 'max-w-[var(--frame-split)]'],
  ] satisfies Array<[PageFrameMode, string]>)('renders the %s responsive canvas contract', (mode, widthClass) => {
    const { container } = render(
      <PageFrame mode={mode} className="test-extension">
        Frame content
      </PageFrame>,
    )

    const frame = container.querySelector(`[data-page-frame="${mode}"]`)
    expect(frame).toHaveAttribute('data-page-frame', mode)
    expect(frame).toHaveClass(widthClass, 'w-full', 'px-[var(--frame-gutter)]', 'test-extension')
  })
})

describe('application shell interactions', () => {
  it('moves focus to main content after route navigation and retains the skip link', async () => {
    shellState.isAdmin = true
    const user = userEvent.setup()
    renderShell()

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    await user.click(screen.getByRole('link', { name: 'Assistant' }))

    expect(await screen.findByRole('heading', { name: 'Assistant workspace' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  })

  it('shows administrator destinations only to administrators', () => {
    shellState.isAdmin = true
    const { unmount } = renderShell()
    expect(screen.getByRole('link', { name: 'Review queue' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pipeline health' })).toBeInTheDocument()

    unmount()
    shellState.isAdmin = false
    renderShell()
    expect(screen.queryByRole('link', { name: 'Review queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pipeline health' })).not.toBeInTheDocument()
  })

  it('dismisses mobile navigation after choosing a destination', async () => {
    shellState.isAdmin = false
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('link', { name: 'Notes' }))

    expect(await screen.findByRole('heading', { name: 'Notes workspace' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
  })
})

describe('shared inspector behavior', () => {
  it('provides an accessible modal, moves focus inside, and closes from its labelled control', async () => {
    const user = userEvent.setup()
    render(<InspectorHarness />)

    await user.click(screen.getByRole('button', { name: 'Inspect task' }))
    const dialog = await screen.findByRole('dialog', { name: 'Task details' })
    const close = within(dialog).getByRole('button', { name: 'Close' })
    expect(dialog).toHaveAccessibleDescription('Inspect the selected task.')
    expect(within(dialog).getByText('Selected task evidence')).toBeInTheDocument()
    await waitFor(() => expect(close).toHaveFocus())

    await user.click(close)

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('dismisses on Escape after focus enters the modal', async () => {
    const user = userEvent.setup()
    render(<InspectorHarness />)

    await user.click(screen.getByRole('button', { name: 'Inspect task' }))
    const dialog = await screen.findByRole('dialog', { name: 'Task details' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus())
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Task details' })).not.toBeInTheDocument())
  })
})
