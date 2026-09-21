import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: Icon
  title: string
  children: ReactNode
  action?: ReactNode
}

// PUBLIC_INTERFACE
export function EmptyState({ icon: IconGlyph, title, children, action }: EmptyStateProps) {
  /**
   * Renders the "nothing here yet" state for a region.
   *
   * The composition is centred so the state reads as a deliberate resting point
   * rather than a half-loaded list, and the icon sits in a washed medallion so
   * it is legible against both paper and surface backgrounds.
   */
  return (
    <div className="flex flex-col items-center gap-4 rounded-(--radius-panel) border border-dashed border-rule-strong bg-surface/60 px-6 py-12 text-center sm:px-10 sm:py-16">
      <span className="grid size-14 place-items-center rounded-full bg-cobalt-wash/70 text-cobalt ring-1 ring-cobalt/15">
        <IconGlyph aria-hidden size={26} weight="duotone" />
      </span>
      <div className="max-w-[52ch]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <div className="mt-2 text-[15px] leading-relaxed text-balance text-ink-2">{children}</div>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
