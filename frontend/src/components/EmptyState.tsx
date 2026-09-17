import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: Icon
  title: string
  children: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: IconGlyph, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-(--radius-panel) border border-dashed border-rule-strong bg-surface/60 px-6 py-10 sm:px-10 sm:py-14">
      <span className="grid size-11 place-items-center rounded-[10px] bg-sunken text-ink-2">
        <IconGlyph aria-hidden size={22} weight="duotone" />
      </span>
      <div className="max-w-[52ch]">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <div className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{children}</div>
      </div>
      {action}
    </div>
  )
}
