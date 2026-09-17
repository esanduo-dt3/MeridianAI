import { Desktop, Moon, Sun, type Icon } from '@phosphor-icons/react'
import { useTheme, type ThemePreference } from './ThemeProvider'

const options: { value: ThemePreference; label: string; icon: Icon }[] = [
  { value: 'system', label: 'Match system', icon: Desktop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Three-way segmented control: system, light, dark. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-0.5 rounded-(--radius-control) border border-rule bg-sunken p-0.5 ${className}`}
    >
      {options.map(({ value, label, icon: Glyph }) => {
        const selected = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`grid size-8 cursor-pointer place-items-center rounded-[6px] transition-colors duration-150 ${
              selected ? 'bg-surface text-ink shadow-(--shadow-hairline)' : 'text-ink-3 hover:text-ink'
            }`}
          >
            <Glyph aria-hidden size={15} weight={selected ? 'bold' : 'regular'} />
          </button>
        )
      })}
    </div>
  )
}
