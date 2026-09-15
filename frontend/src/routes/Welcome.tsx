import { Navigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Wordmark } from '../components/Wordmark'
import { Skeleton } from '../components/Feedback'
import { ThemeToggle } from '../theme/ThemeToggle'
import { CreateWorkspaceForm } from '../workspace/CreateWorkspaceForm'
import { useWorkspace } from '../workspace/WorkspaceProvider'

/** First run: a signed-in person with no workspace creates one, or waits to be added. */
export function Welcome() {
  const { user, signOut } = useAuth()
  const { workspaces, loading } = useWorkspace()

  if (!loading && workspaces.length > 0) return <Navigate to="/tasks" replace />

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Wordmark size="md" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <SignOut aria-hidden size={16} weight="bold" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-12">
        {loading ? (
          <div className="flex flex-col gap-4" role="status" aria-label="Loading your workspaces">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.04em] text-ink sm:text-[40px]">
              Create your first workspace
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              A workspace holds your team's documents, notes and tasks. Everything in it is visible only to the people
              you add.
            </p>
            <div className="mt-8 rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-panel)">
              <CreateWorkspaceForm autoFocus />
            </div>
            <p className="mt-6 text-sm leading-relaxed text-ink-3">
              Joining a team instead? Ask an Admin to add{' '}
              <span className="font-medium text-ink-2">{user?.email ?? 'your email'}</span>. The workspace will appear
              here once they do.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
