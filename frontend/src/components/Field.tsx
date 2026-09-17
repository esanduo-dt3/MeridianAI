import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { CaretDown } from '@phosphor-icons/react'

const control =
  'min-h-11 w-full rounded-(--radius-control) border border-rule-strong bg-surface px-3 text-[15px] text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 hover:border-ink-3 focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger'

interface FieldShellProps {
  label: string
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
  className?: string
  children: (ids: { id: string; describedBy?: string }) => ReactNode
}

function FieldShell({ label, hint, error, hideLabel, className = '', children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-ink'}>
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
  wrapperClassName?: string
}

export function TextField({ label, hint, error, hideLabel, wrapperClassName, className = '', ...input }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className={`${control} ${className}`} {...input} />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string | null
  hideLabel?: boolean
  wrapperClassName?: string
  children: ReactNode
}

export function SelectField({ label, hint, error, hideLabel, wrapperClassName, className = '', children, ...select }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={wrapperClassName}>
      {({ id, describedBy }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            className={`${control} cursor-pointer appearance-none pr-9 ${className}`}
            {...select}
          >
            {children}
          </select>
          <CaretDown aria-hidden size={14} weight="bold" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
        </div>
      )}
    </FieldShell>
  )
}
