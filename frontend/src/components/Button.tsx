import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  leading?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-white hover:bg-[#252a31] shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(17_20_24/0.2)]',
  secondary: 'bg-surface text-ink border border-rule-strong hover:border-ink-3 hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-sunken hover:text-ink',
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
