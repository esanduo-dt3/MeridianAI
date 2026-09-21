import { Link } from 'react-router-dom'
import { Wordmark } from '../components/Wordmark'

/** Renders the application fallback route with a safe path back to the workspace. */
// PUBLIC_INTERFACE
export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-5 py-8 sm:px-8">
      <header className="mx-auto w-full max-w-5xl">
        <Wordmark size="sm" />
      </header>
      <main className="mx-auto my-auto w-full max-w-[36rem] rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-panel) sm:p-10">
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">This page doesn't exist.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Check the address, or go back to your workspace.</p>
        <Link
          to="/tasks"
          className="mt-6 inline-flex min-h-11 items-center rounded-(--radius-control) bg-ink px-4 text-[15px] font-medium text-on-ink hover:bg-ink-hover"
        >
          Go to workspace
        </Link>
      </main>
    </div>
  )
}
