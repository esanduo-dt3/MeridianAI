import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { apiFetch, setApiWorkspace } from '../lib/api'
import type { MeResponse, Profile, WorkspaceSummary } from '../lib/types'

const STORAGE_KEY = 'meridian-workspace'

interface WorkspaceContextValue {
  profile: Profile | null
  workspaces: WorkspaceSummary[]
  active: WorkspaceSummary | null
  isAdmin: boolean
  loading: boolean
  error: unknown
  refetch: () => void
  switchWorkspace: (id: string) => void
  createWorkspace: (name: string) => Promise<WorkspaceSummary>
  creating: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function storedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(storedWorkspaceId)

  const me = useQuery({
    queryKey: ['me', session?.user.id],
    queryFn: () => apiFetch<MeResponse>('/me', { unscoped: true }),
    enabled: Boolean(session),
  })

  const workspaces = useMemo(() => me.data?.workspaces ?? [], [me.data])
  // Fall back to the first workspace if the remembered one is gone (left or removed).
  const active = workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null

  // Keep the API header in step with the active workspace before children fetch.
  setApiWorkspace(active?.id ?? null)

  useEffect(() => {
    if (!active) return
    try {
      localStorage.setItem(STORAGE_KEY, active.id)
    } catch {
      // Remembering the workspace is a convenience only.
    }
  }, [active])

  const switchWorkspace = useCallback(
    (id: string) => {
      setSelectedId(id)
      setApiWorkspace(id)
      // Everything workspace-scoped is refetched for the new workspace.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'ws' })
    },
    [queryClient],
  )

  const create = useMutation({
    mutationFn: (name: string) => apiFetch<WorkspaceSummary>('/workspaces', { method: 'POST', body: { name }, unscoped: true }),
    onSuccess: (workspace) => {
      queryClient.setQueryData<MeResponse>(['me', session?.user.id], (current) =>
        current ? { ...current, workspaces: [...current.workspaces, workspace] } : current,
      )
      switchWorkspace(workspace.id)
    },
  })

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      profile: me.data?.user ?? null,
      workspaces,
      active,
      isAdmin: active?.auth_role === 'Admin',
      loading: me.isPending,
      error: me.error,
      refetch: () => void me.refetch(),
      switchWorkspace,
      createWorkspace: create.mutateAsync,
      creating: create.isPending,
    }),
    [me, workspaces, active, switchWorkspace, create.mutateAsync, create.isPending],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return context
}

/** Query key helper: every workspace-scoped query starts with ['ws', workspaceId]. */
// eslint-disable-next-line react-refresh/only-export-components
export function wsKey(workspaceId: string | undefined, ...parts: unknown[]) {
  return ['ws', workspaceId, ...parts] as const
}
