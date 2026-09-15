import { Navigate, Outlet } from 'react-router-dom'
import { ErrorState, Skeleton } from '../components/Feedback'
import { Wordmark } from '../components/Wordmark'
import { errorText } from '../lib/queryClient'
import { useWorkspace } from './WorkspaceProvider'

/** Gate for the app shell: needs a loaded profile and at least one workspace. */
export function RequireWorkspace() {
  const { loading, error, workspaces, refetch } = useWorkspace()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center px-5" role="status" aria-label="Loading your workspace">
        <div className="flex w-full max-w-xs flex-col items-center gap-5">
          <Wordmark />
          <Skeleton className="h-2 w-40" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5">
        <Wordmark />
        <ErrorState title="Your workspaces couldn't be loaded" message={errorText(error)} onRetry={refetch} />
      </div>
    )
  }

  if (workspaces.length === 0) return <Navigate to="/welcome" replace />
  return <Outlet />
}
