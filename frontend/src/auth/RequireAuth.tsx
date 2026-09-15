import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Wordmark } from '../components/Wordmark'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4">
          <Wordmark />
          <span className="h-0.5 w-24 overflow-hidden rounded-full bg-rule">
            <span className="block h-full w-1/3 animate-[meridian-scan_1.1s_var(--ease-out-quint)_infinite] rounded-full bg-cobalt" />
          </span>
          <span className="sr-only">Checking your session</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
