import type { ReactNode } from 'react'

export type PageFrameMode = 'reading' | 'operational' | 'split'

interface PageFrameProps {
  mode: PageFrameMode
  children: ReactNode
  className?: string
}

const frameStyles: Record<PageFrameMode, string> = {
  reading: 'max-w-[var(--frame-reading)]',
  operational: 'max-w-[var(--frame-operational)]',
  split: 'max-w-[var(--frame-split)]',
}

// PUBLIC_INTERFACE
export function PageFrame({ mode, children, className = '' }: PageFrameProps) {
  /** Provides a route-owned responsive canvas while AppShell retains global navigation and focus behavior. */
  return (
    <div
      data-page-frame={mode}
      className={`mx-auto w-full px-[var(--frame-gutter)] py-8 lg:py-10 ${frameStyles[mode]} ${className}`}
    >
      {children}
    </div>
  )
}
