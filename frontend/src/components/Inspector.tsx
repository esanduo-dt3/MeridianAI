import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

interface InspectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const widths: Record<NonNullable<InspectorProps['width']>, string> = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[500px]',
  lg: 'sm:max-w-[560px]',
}

// PUBLIC_INTERFACE
export function Inspector({
  open,
  onOpenChange,
  title,
  description = 'Contextual details and actions.',
  children,
  width = 'md',
}: InspectorProps) {
  /** Provides an accessible responsive edge inspector with focus trapping, dismissal, and focus return. */
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] data-[state=open]:animate-[meridian-fade_var(--duration-quick)_ease-out]" />
        <RadixDialog.Content
          className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-rule bg-surface shadow-(--shadow-lift) outline-none data-[state=open]:animate-[meridian-slide_var(--duration-panel)_var(--ease-out-quint)] ${widths[width]}`}
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{description}</RadixDialog.Description>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

interface InspectorCloseProps {
  className?: string
}

// PUBLIC_INTERFACE
export function InspectorClose({ className = '' }: InspectorCloseProps) {
  /** Closes the nearest Inspector while retaining Radix focus-return behavior. */
  return (
    <RadixDialog.Close
      aria-label="Close"
      className={`grid size-10 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-sunken hover:text-ink ${className}`}
    >
      <X size={18} weight="bold" />
    </RadixDialog.Close>
  )
}
