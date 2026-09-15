import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md'
}

/** Accessible modal (focus trap, Escape, scroll lock) styled with Meridian tokens. */
export function Dialog({ open, onOpenChange, title, description, children, footer, width = 'sm' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-[meridian-fade_150ms_ease-out]" />
        <RadixDialog.Content
          className={`fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-lift) outline-none data-[state=open]:animate-[meridian-pop_180ms_var(--ease-out-quint)] ${
            width === 'md' ? 'max-w-lg' : 'max-w-md'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <RadixDialog.Title className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">{title}</RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X size={18} weight="bold" />
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => void
  pending?: boolean
  error?: string | null
}

/** Confirmation for destructive actions. The confirm button names the action. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, pending, error }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  )
}
