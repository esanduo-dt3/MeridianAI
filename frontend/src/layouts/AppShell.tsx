import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CheckSquareOffset,
  Files,
  List,
  ListMagnifyingGlass,
  NotePencil,
  Pulse,
  Robot,
  SidebarSimple,
  SignOut,
  Tray,
  UsersThree,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import { ReliabilityNote } from '../components/ReliabilityNote'
import { Wordmark } from '../components/Wordmark'
import { ThemeToggle } from '../theme/ThemeToggle'
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { readRailCollapsed, writeRailCollapsed } from './railPreference'

interface NavItem {
  to: string
  label: string
  icon: Icon
}

const workspaceNav: NavItem[] = [
  { to: '/tasks', label: 'Tasks', icon: CheckSquareOffset },
  { to: '/assistant', label: 'Assistant', icon: Robot },
  { to: '/notes', label: 'Notes', icon: NotePencil },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/members', label: 'Members', icon: UsersThree },
]

// Shown to Admins only; the pages and the API enforce the same rule.
const adminNav: NavItem[] = [
  { to: '/admin/review', label: 'Review queue', icon: Tray },
  { to: '/admin/audit', label: 'Audit log', icon: ListMagnifyingGlass },
  { to: '/admin/health', label: 'Pipeline health', icon: Pulse },
]

// PUBLIC_INTERFACE
export function AppShell() {
  /**
   * Authenticated application shell: the skip link, the collapsible desktop
   * navigation rail, the mobile top bar and drawer, and the focusable `main`
   * region that hosts the routed outlet.
   *
   * The desktop rail has two widths driven entirely by the `--rail-expanded`
   * and `--rail-collapsed` tokens. The width lives in an inline
   * `gridTemplateColumns` rather than a utility class (DEC-02) because a
   * Tailwind class cannot interpolate a runtime value, and duplicating the
   * widths in two class strings would let the grid column and the `aside`
   * disagree. The collapse preference is seeded synchronously so the first
   * paint already reflects the stored choice, and it has no effect below the
   * `lg` breakpoint where the layout is a single column.
   */
  const location = useLocation()
  const reduce = useReducedMotion()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed)
  const mainRef = useRef<HTMLElement>(null)

  // Move focus to the new page on navigation so screen readers announce it.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  // Persist on the same tick as the state change so a reload always agrees with the rendered rail.
  const toggleRail = () => {
    setRailCollapsed((current) => {
      writeRailCollapsed(!current)
      return !current
    })
  }

  return (
    <div
      className="min-h-dvh transition-[grid-template-columns] duration-[var(--duration-panel)] ease-[var(--ease-out-quint)] lg:grid"
      style={{
        gridTemplateColumns: `${railCollapsed ? 'var(--rail-collapsed)' : 'var(--rail-expanded)'} minmax(0,1fr)`,
      }}
    >
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-on-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/*
        Desktop sidebar: a floating liquid-glass panel inset from the viewport
        edges. The material comes from the shared `.liquid-glass` definition so
        no local opacity or blur values are invented here.
      */}
      <aside className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="liquid-glass flex h-full flex-col overflow-hidden rounded-[20px]">
          <Sidebar layoutGroup="desktop" collapsed={railCollapsed} onToggleCollapse={toggleRail} />
        </div>
      </aside>

      {/* Mobile top bar: the same floating glass material, as a rounded bar. */}
      <div className="sticky top-0 z-30 px-3 pt-3 lg:hidden">
        <div className="liquid-glass flex h-14 items-center justify-between rounded-[18px] pr-2 pl-4">
          <Wordmark size="sm" />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="grid size-11 cursor-pointer place-items-center rounded-(--radius-control) text-ink-2 transition-colors duration-150 hover:bg-[var(--glass-raised)] hover:text-ink"
          >
            <List size={22} weight="bold" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <motion.button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 cursor-default bg-black/50"
            />
            <motion.aside
              initial={reduce ? { opacity: 0 } : { x: '-100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="liquid-glass absolute inset-y-3 left-3 w-[min(84vw,300px)] overflow-hidden rounded-[20px]"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="absolute top-3 right-3 z-10 grid size-11 cursor-pointer place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-[var(--glass-raised)] hover:text-ink"
              >
                <X size={20} weight="bold" />
              </button>
              {/* The drawer never collapses: the rail preference is a desktop-only concern. */}
              <Sidebar layoutGroup="mobile" onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}

interface SidebarProps {
  layoutGroup: string
  onNavigate?: () => void
  /** Collapsed presentation; only the desktop rail ever sets this. */
  collapsed?: boolean
  /** Supplied only by the desktop rail, which is what gates the collapse control. */
  onToggleCollapse?: () => void
}

function Sidebar({ layoutGroup, onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
  const { isAdmin } = useWorkspace()
  return (
    <div className={`flex h-full flex-col pt-4 pb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
      <div className={collapsed ? 'flex flex-col items-center gap-2 pb-4' : 'flex items-center gap-2 pb-5'}>
        <div className={collapsed ? 'contents' : 'min-w-0 flex-1'}>
          <WorkspaceSwitcher onNavigate={onNavigate} collapsed={collapsed} />
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-(--radius-control) text-ink-3 transition-colors duration-150 hover:bg-[var(--glass-raised)] hover:text-ink"
          >
            <SidebarSimple aria-hidden size={18} weight="bold" className={collapsed ? 'rotate-180' : undefined} />
          </button>
        )}
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <NavGroup
          label="Workspace"
          items={workspaceNav}
          layoutGroup={layoutGroup}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
        {isAdmin && (
          <NavGroup
            label="Admin"
            items={adminNav}
            layoutGroup={layoutGroup}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        )}
      </nav>

      <div
        className={`flex flex-col border-t border-[var(--glass-edge)] pt-4 ${
          collapsed ? 'items-center gap-3' : 'gap-4 px-3'
        }`}
      >
        {/* A 72px column cannot render a sentence; the same text stays on the Assistant route. */}
        {!collapsed && <ReliabilityNote compact />}
        <ThemeToggle className={collapsed ? 'flex-col' : 'self-start'} />
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  )
}

function NavGroup({ label, items, layoutGroup, onNavigate, collapsed = false }: SidebarProps & { label: string; items: NavItem[] }) {
  return (
    <div>
      {collapsed ? (
        // Truncated "Workspace"/"Admin" words read as noise at 72px, so the group
        // boundary becomes a decorative hairline instead.
        <div aria-hidden className="mx-auto mb-1.5 h-px w-8 rounded-full bg-[var(--glass-edge)]" />
      ) : (
        <p className="px-3 pb-1.5 text-xs font-medium text-ink-3">{label}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group relative flex min-h-10 items-center rounded-(--radius-control) text-[14.5px] transition-colors duration-150 ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-[var(--glass-raised)] font-medium text-ink shadow-(--shadow-hairline)'
                    : 'text-ink-2 hover:bg-[var(--glass-raised)] hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={`nav-meridian-${layoutGroup}`}
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-cobalt"
                    />
                  )}
                  <item.icon
                    aria-hidden
                    size={18}
                    weight={isActive ? 'fill' : 'regular'}
                    className={isActive ? 'text-cobalt' : 'text-ink-3 group-hover:text-ink-2'}
                  />
                  {/* Collapsed keeps the label in the accessibility tree rather than swapping to
                      aria-label, so every destination resolves by the same accessible name. */}
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user, signOut } = useAuth()
  const { profile } = useWorkspace()
  const [error, setError] = useState<string | null>(null)
  const email = profile?.email ?? user?.email ?? 'Signed in'
  const name = profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? email
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)

  async function handleSignOut() {
    setError(null)
    try {
      await signOut()
    } catch {
      setError('Sign-out failed. Try again.')
    }
  }

  const signOutButton = (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      title="Sign out"
      className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
    >
      <SignOut size={18} weight="bold" />
    </button>
  )

  return (
    <div className={collapsed ? 'flex flex-col items-center' : undefined}>
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <span title={name}>
            <Avatar name={name} email={email} src={avatar} size={32} />
          </span>
          {signOutButton}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={name} email={email} src={avatar} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink" title={name}>
              {name}
            </p>
            <p className="truncate text-xs text-ink-3" title={email}>
              {email}
            </p>
          </div>
          {signOutButton}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
