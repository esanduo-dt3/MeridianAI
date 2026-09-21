/**
 * Persistence for the desktop navigation rail's collapsed/expanded choice.
 *
 * This mirrors the read/write shape of `frontend/src/theme/ThemeProvider.tsx`
 * deliberately (DEC-01 of the UI redesign plan) so the codebase keeps one
 * persistence idiom: a module-level key, a synchronous reader safe to use as a
 * `useState` initializer, and `try`/`catch` on both sides so a blocked storage
 * API (private browsing, disabled cookies) degrades to an in-memory choice for
 * the visit instead of throwing during render.
 *
 * The default is expanded, so a profile with no stored value renders exactly
 * the layout that existed before the rail became collapsible.
 */
const RAIL_KEY = 'meridian-rail'

// PUBLIC_INTERFACE
export function readRailCollapsed(): boolean {
  /**
   * Read the persisted rail preference.
   *
   * @returns `true` when the person previously collapsed the rail, otherwise
   * `false`. Any storage failure resolves to `false` (expanded), which is the
   * documented default.
   */
  try {
    return localStorage.getItem(RAIL_KEY) === 'collapsed'
  } catch {
    return false
  }
}

// PUBLIC_INTERFACE
export function writeRailCollapsed(collapsed: boolean): void {
  /**
   * Persist the rail preference.
   *
   * Collapsed is stored explicitly; expanded removes the key so the absence of
   * a value and the default agree, and so no stale value survives a future
   * change of default.
   *
   * @param collapsed - `true` to remember the collapsed rail, `false` to forget it.
   */
  try {
    if (collapsed) localStorage.setItem(RAIL_KEY, 'collapsed')
    else localStorage.removeItem(RAIL_KEY)
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}
