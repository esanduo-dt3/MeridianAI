import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description: string
  eyebrow?: ReactNode
  status?: 'not-built'
  actions?: ReactNode
}

// PUBLIC_INTERFACE
export function PageHeader({ title, description, eyebrow, status, actions }: PageHeaderProps) {
  /**
   * Renders a route heading for reading-oriented and low-density pages.
   *
   * Unlike `OperationalHeader` this header does not float: reading routes scroll
   * as a single column, so a static rule under the title keeps the measure calm.
   */
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-[62ch]">
        {eyebrow && <div className="mb-1 text-xs font-medium tracking-[0.08em] text-ink-3 uppercase">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[27px] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[30px]">
            {title}
          </h1>
          {status === 'not-built' && (
            <span className="rounded-full border border-rule-strong bg-surface px-2.5 py-0.5 font-mono text-[11px] text-ink-3">
              Not built yet
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
