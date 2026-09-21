import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import type { AuthRole } from '../lib/types'
import { Button } from './Button'

// PUBLIC_INTERFACE
export function Skeleton({ className = '' }: { className?: string }) {
  /** Renders a placeholder block with a slow sheen while a region loads. */
  return <span aria-hidden className={`skeleton-sheen block rounded-md bg-sunken ${className}`} />
}

interface ErrorStateProps {
  title: string
  message: string
  onRetry?: () => void
}

// PUBLIC_INTERFACE
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  /** Inline failure for a region that could not load. States what failed and offers a retry. */
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-(--radius-panel) border border-danger/30 bg-danger-wash px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 text-danger">
          <WarningCircle aria-hidden size={20} weight="bold" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm break-words text-ink-2">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          className="shrink-0 self-start sm:self-auto"
          leading={<ArrowClockwise aria-hidden size={16} weight="bold" />}
        >
          Try again
        </Button>
      )}
    </div>
  )
}

// PUBLIC_INTERFACE
export function RoleBadge({ role }: { role: AuthRole }) {
  /** Shows whether a person is an Admin or a Member of the active workspace. */
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        role === 'Admin' ? 'bg-cobalt-wash text-cobalt ring-cobalt/20' : 'bg-sunken text-ink-2 ring-rule'
      }`}
    >
      {role}
    </span>
  )
}
