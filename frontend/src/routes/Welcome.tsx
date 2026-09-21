import { Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Pulse, Robot, SealCheck, SignOut, Tray, type Icon } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Wordmark } from '../components/Wordmark'
import { Skeleton } from '../components/Feedback'
import { ThemeToggle } from '../theme/ThemeToggle'
import { CreateWorkspaceForm } from '../workspace/CreateWorkspaceForm'
import { useWorkspace } from '../workspace/WorkspaceProvider'

interface EvidenceItem {
  icon: Icon
  title: string
  body: string
}

/**
 * The four statements shown beside the creation form.
 *
 * Every item describes behaviour that exists in this repository: the citation and
 * uncalibrated-confidence wording comes from `ReliabilityNote`, the review routing
 * is that same note plus the `/admin/review` route, and the approval gate is the
 * `ProposalsPanel` behaviour on the Tasks route. No metric, logo or preview of
 * unbuilt work belongs in this list.
 */
const EVIDENCE: EvidenceItem[] = [
  {
    icon: SealCheck,
    title: 'Answers cite the passage they used',
    body: 'Every answer points at the exact source passage behind it, so you can read the original before you act on it.',
  },
  {
    icon: Pulse,
    title: 'Confidence is shown, and labelled uncalibrated',
    body: 'Each answer carries a confidence value. Meridian tells you it is uncalibrated, so it is never presented as a probability.',
  },
  {
    icon: Tray,
    title: 'Weak answers go to a person',
    body: 'Low-confidence or ungrounded answers are routed to the review queue instead of being handed over as fact.',
  },
  {
    icon: Robot,
    title: 'The agent proposes, an Admin decides',
    body: 'Tasks the agent suggests wait in a proposal list. Nothing is added to the workspace until an Admin approves it.',
  },
]

/** First run: a signed-in person with no workspace creates one, or waits to be added. */
// PUBLIC_INTERFACE
export function Welcome() {
  const { user, signOut } = useAuth()
  const { workspaces, loading } = useWorkspace()
  const reduce = useReducedMotion()

  if (!loading && workspaces.length > 0) return <Navigate to="/tasks" replace />

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-paper px-5 py-8 sm:px-8">
      {/* Static ambience only: a token-coloured wash so the page is not a bare sheet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(75%_100%_at_50%_0%,var(--color-cobalt-wash),transparent)]"
      />

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

      <motion.main
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto my-auto grid w-full max-w-5xl gap-10 py-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-14"
      >
        {/* Primary column first in source order, so the stacked layout still leads
            with the autofocused workspace-name field. */}
        <section>
          {loading ? (
            <div className="flex flex-col gap-4" role="status" aria-label="Loading your workspaces">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-[0.16em] text-ink-3 uppercase">Getting started</p>
              <h1 className="mt-3 font-display text-[34px] leading-tight font-semibold tracking-[-0.04em] text-ink sm:text-[40px]">
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
        </section>

        {/* Hidden below the large breakpoint so narrow-viewport screen-reader users are
            not sent through a decorative detour before the form. The same claims stay
            available inside the product through ReliabilityNote. */}
        <aside
          aria-label="What a workspace gives you"
          className="hidden rounded-(--radius-panel) border border-[var(--glass-edge)] bg-[var(--glass-surface)] p-7 backdrop-blur-[var(--glass-blur)] lg:block"
        >
          <h2 className="font-display text-[19px] leading-snug font-semibold tracking-[-0.02em] text-ink">
            What you get once it exists
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            Meridian answers from your own documents, and it shows its work.
          </p>

          <ul className="mt-6 flex flex-col gap-5">
            {EVIDENCE.map((item) => {
              const ItemIcon = item.icon
              return (
                <li key={item.title} className="flex gap-3.5">
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) border border-[var(--glass-edge)] bg-[var(--glass-raised)] text-cobalt"
                  >
                    <ItemIcon size={18} weight="bold" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="mt-7 border-t border-[var(--glass-edge)] pt-5 text-xs leading-relaxed text-ink-3">
            AI answers and agent actions can be incomplete or wrong. Check the cited passage before you act on one.
          </p>
        </aside>
      </motion.main>
    </div>
  )
}
