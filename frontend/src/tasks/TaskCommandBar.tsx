import type { ReactNode } from 'react'

interface TaskCommandBarProps {
  /** Route identity rendered as the page heading. */
  title: string
  /** Active workspace name, shown as a secondary label beside the title. */
  workspaceName?: string
  openCount: number
  doneCount: number
  /** Counters render only once the board has loaded, so no placeholder number is shown. */
  showCounts: boolean
  viewTabs: ReactNode
  filterField: ReactNode
  completedToggle: ReactNode
  /** Optional because sorting applies to the list view only. */
  sortControl?: ReactNode
  sprintScope: ReactNode
  /** Result summary shown while a filter is active. */
  matchSummary?: ReactNode
  /** Role guidance for Members; kept as visible text rather than a tooltip. */
  permissionHint?: ReactNode
  label?: string
}

// PUBLIC_INTERFACE
export function TaskCommandBar({
  title,
  workspaceName,
  openCount,
  doneCount,
  showCounts,
  viewTabs,
  filterField,
  completedToggle,
  sortControl,
  sprintScope,
  matchSummary,
  permissionHint,
  label = 'Task command bar',
}: TaskCommandBarProps) {
  /**
   * Renders the Tasks route's working context as one sticky glass band of at most two rows.
   *
   * The component is purely presentational: every value and control is supplied by the route,
   * so task state, URL parameters and keyboard shortcuts stay with `TasksPage`.
   *
   * Layout notes that are contracts rather than taste:
   * - `z-20` keeps the band below the mobile top bar (`z-30`), the drawer and inspector (`z-40`)
   *   and dialog/menu content (`z-50`), so it can never cover an overlay.
   * - `top-14 lg:top-0` parks the band directly under the `h-14` mobile top bar and at the
   *   viewport edge on desktop, where no top bar exists.
   * - The negative inline margin plus matching padding bleeds the glass to the frame edge,
   *   because `PageFrame` owns the gutter outside this component and rows would otherwise
   *   scroll through a transparent strip.
   * - The second row never wraps; it scrolls horizontally inside `bounded-overflow` so a wide
   *   sprint strip cannot push the band to a third row.
   */
  return (
    <section
      aria-label={label}
      className="sticky top-14 z-20 -mx-[var(--frame-gutter)] flex flex-col gap-2 border-b border-[var(--glass-edge)] bg-[var(--glass-surface)] px-[var(--frame-gutter)] py-2.5 backdrop-blur-[var(--glass-blur)] lg:top-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <h1 className="font-display shrink-0 text-[22px] leading-none font-semibold tracking-[-0.03em] text-ink">
          {title}
        </h1>

        {workspaceName && (
          <span className="hidden min-w-0 truncate text-sm text-ink-3 sm:block" title={workspaceName}>
            {workspaceName}
          </span>
        )}

        {showCounts && (
          <p className="shrink-0 text-sm text-ink-2">
            <span className="tabular font-medium text-ink">{openCount}</span> open &middot;{' '}
            <span className="tabular font-medium text-ink">{doneCount}</span> done
          </p>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">{viewTabs}</div>
      </div>

      <div className="bounded-overflow">
        <div className="flex min-w-max items-center gap-3 lg:min-w-0">
          {filterField}
          {completedToggle}
          {sortControl}

          <span aria-hidden className="h-6 w-px shrink-0 bg-[var(--glass-edge)]" />

          {sprintScope}

          {(matchSummary || permissionHint) && (
            <div className="flex shrink-0 items-center gap-3 text-sm text-ink-3 lg:ml-auto">
              {matchSummary}
              {permissionHint}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
