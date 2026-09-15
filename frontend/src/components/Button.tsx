import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  leading?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-on-ink hover:bg-ink-hover shadow-(--shadow-control)',
  secondary: 'bg-surface text-ink border border-rule-strong hover:border-ink-3 hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-on-ink hover:opacity-90',
}

export function Button({ variant = 'primary', loading = false, leading, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 rounded-(--radius-control) px-4 text-[15px] font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        leading
      )}
      {children}
    </button>
  )
}
