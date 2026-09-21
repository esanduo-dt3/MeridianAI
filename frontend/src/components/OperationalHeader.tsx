import type { ReactNode } from 'react'

interface OperationalHeaderProps {
  title: string
  description?: ReactNode
  eyebrow?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  className?: string
}

// PUBLIC_INTERFACE
export function OperationalHeader({
  title,
  description,
  eyebrow,
  status,
  actions,
  className = '',
}: OperationalHeaderProps) {
  /** Renders route identity, concise status, and primary view actions for operational workspaces. */
  return (
    <header className={`flex flex-col gap-4 border-b border-rule pb-5 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0 max-w-[72ch]">
        {eyebrow && (
          <div className="mb-1 text-xs font-medium tracking-[0.08em] text-ink-3 uppercase">
            {eyebrow}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[27px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[30px]">
            {title}
          </h1>
          {status}
        </div>
        {description && <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
