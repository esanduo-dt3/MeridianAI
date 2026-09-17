import { Link } from 'react-router-dom'
import { Wordmark } from '../components/Wordmark'

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <Wordmark size="sm" />
      <main className="my-auto max-w-[36rem]">
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
