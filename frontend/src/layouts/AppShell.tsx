import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ChatTeardropText,
  CheckSquareOffset,
  Files,
  List,
  ListMagnifyingGlass,
  NotePencil,
  Pulse,
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

interface NavItem {
  to: string
  label: string
  icon: Icon
}

const workspaceNav: NavItem[] = [
  { to: '/tasks', label: 'Tasks', icon: CheckSquareOffset },
  { to: '/ask', label: 'Ask', icon: ChatTeardropText },
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

export function AppShell() {
  const location = useLocation()
  const reduce = useReducedMotion()
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-on-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r border-rule bg-paper lg:block">
        <Sidebar layoutGroup="desktop" />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-rule bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Wordmark size="sm" />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          className="grid size-11 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-sunken"
        >
          <List size={22} weight="bold" />
        </button>
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
              className="absolute inset-y-0 left-0 w-[min(84vw,300px)] border-r border-rule bg-paper shadow-(--shadow-lift)"
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="absolute top-3 right-3 grid size-11 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-sunken"
              >
                <X size={20} weight="bold" />
              </button>
              <Sidebar layoutGroup="mobile" onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"
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
}

function Sidebar({ layoutGroup, onNavigate }: SidebarProps) {
  const { isAdmin } = useWorkspace()
  return (
    <div className="flex h-full flex-col px-3 pt-4 pb-4">
      <div className="pb-5">
        <WorkspaceSwitcher onNavigate={onNavigate} />
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <NavGroup label="Workspace" items={workspaceNav} layoutGroup={layoutGroup} onNavigate={onNavigate} />
        {isAdmin && <NavGroup label="Admin" items={adminNav} layoutGroup={layoutGroup} onNavigate={onNavigate} />}
      </nav>

      <div className="flex flex-col gap-4 border-t border-rule px-3 pt-4">
        <ReliabilityNote compact />
        <ThemeToggle className="self-start" />
        <UserMenu />
      </div>
    </div>
  )
}

function NavGroup({ label, items, layoutGroup, onNavigate }: SidebarProps & { label: string; items: NavItem[] }) {
  return (
    <div>
      <p className="px-3 pb-1.5 text-xs font-medium text-ink-3">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex min-h-10 items-center gap-3 rounded-(--radius-control) px-3 text-[14.5px] transition-colors duration-150 ${
                  isActive ? 'bg-surface font-medium text-ink shadow-(--shadow-hairline)' : 'text-ink-2 hover:bg-sunken hover:text-ink'
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
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UserMenu() {
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

  return (
    <div>
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
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <SignOut size={18} weight="bold" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
