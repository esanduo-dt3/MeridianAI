import type { ReactNode } from 'react'

interface WorkspaceToolbarProps {
  children: ReactNode
  trailing?: ReactNode
  label?: string
  className?: string
}

// PUBLIC_INTERFACE
export function WorkspaceToolbar({
  children,
  trailing,
  label = 'Workspace controls',
  className = '',
}: WorkspaceToolbarProps) {
  /** Groups dense operational controls while keeping overflow local to the toolbar. */
  return (
    <section
      aria-label={label}
      className={`bounded-overflow rounded-(--radius-panel) border border-rule bg-surface px-3 py-2.5 shadow-(--shadow-hairline) ${className}`}
    >
      <div className="flex min-w-max flex-wrap items-center gap-3 sm:min-w-0">
        {children}
        {trailing && <div className="text-sm text-ink-3 sm:ml-auto">{trailing}</div>}
      </div>
    </section>
  )
}
