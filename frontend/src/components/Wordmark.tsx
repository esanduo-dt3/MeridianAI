interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { text: 'text-[17px]', bar: 'h-4' },
  md: { text: 'text-xl', bar: 'h-5' },
  lg: { text: 'text-3xl', bar: 'h-7' },
}

/** Type-only wordmark. The cobalt bar is the meridian: the reference line everything is measured against. */
export function Wordmark({ size = 'md' }: WordmarkProps) {
  const s = sizes[size]
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span aria-hidden className={`${s.bar} w-[3px] rounded-full bg-cobalt`} />
      <span className={`${s.text} font-display font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_90]`}>
        Meridian
      </span>
    </span>
  )
}
