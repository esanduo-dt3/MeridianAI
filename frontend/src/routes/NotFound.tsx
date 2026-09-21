import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Wordmark } from '../components/Wordmark'

// PUBLIC_INTERFACE
export function NotFound() {
  /** Renders the application fallback route with a safe path back to the workspace. */
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-paper px-5 py-8 sm:px-8">
      {/* Token-coloured wash so the fallback route is not a bare sheet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(75%_100%_at_50%_0%,var(--color-cobalt-wash),transparent)]"
      />

      <header className="mx-auto w-full max-w-5xl">
        <Wordmark size="sm" />
      </header>

      <main className="mx-auto my-auto w-full max-w-[36rem] rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-panel) sm:p-10">
        <p className="font-mono text-sm tracking-[0.12em] text-ink-3 uppercase">Error 404</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">This page doesn't exist.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Check the address, or go back to your workspace.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/tasks"
            className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-ink px-4 text-[15px] font-medium text-on-ink shadow-(--shadow-control) transition-colors hover:bg-ink-hover"
          >
            Go to workspace
            <ArrowRight aria-hidden size={16} weight="bold" />
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-rule-strong bg-surface px-4 text-[15px] font-medium text-ink transition-colors hover:border-ink-3 hover:bg-paper"
          >
            <ArrowLeft aria-hidden size={16} weight="bold" />
            Go back
          </button>
        </div>
      </main>
    </div>
  )
}
