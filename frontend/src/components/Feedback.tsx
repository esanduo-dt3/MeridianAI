import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import type { AuthRole } from '../lib/types'
import { Button } from './Button'

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-md bg-sunken ${className}`} />
}

interface ErrorStateProps {
  title: string
  message: string
  onRetry?: () => void
}

/** Inline failure for a region that could not load. States what failed and offers a retry. */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-(--radius-panel) border border-danger/30 bg-danger-wash px-5 py-4">
      <div className="flex gap-2.5">
        <WarningCircle aria-hidden size={20} weight="bold" className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-ink-2">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} leading={<ArrowClockwise aria-hidden size={16} weight="bold" />}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function RoleBadge({ role }: { role: AuthRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        role === 'Admin' ? 'bg-cobalt-wash text-cobalt' : 'bg-sunken text-ink-2'
      }`}
    >
      {role}
    </span>
  )
}
