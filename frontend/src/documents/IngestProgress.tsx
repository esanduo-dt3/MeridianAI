export function ProgressBar({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  const percent = Math.round(value * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-1.5 overflow-hidden rounded-full bg-sunken ${className}`}
    >
      <div className="h-full rounded-full bg-cobalt transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
  )
}
