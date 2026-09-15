interface AvatarProps {
  name: string | null | undefined
  email?: string | null
  src?: string | null
  size?: number
  className?: string
}

/** Profile photo, or initials on a tinted disc when there is no photo. */
export function Avatar({ name, email, src, size = 32, className = '' }: AvatarProps) {
  const label = name || email || '?'
  const initials = label
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

  if (src) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full bg-sunken object-cover ${className}`}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={`grid shrink-0 place-items-center rounded-full bg-cobalt-wash font-semibold text-cobalt ${className}`}
    >
      {initials || '?'}
    </span>
  )
}
