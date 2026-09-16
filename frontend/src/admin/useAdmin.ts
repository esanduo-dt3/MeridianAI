import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { errorText } from '../lib/queryClient'
import type { AuditPage, PipelineHealth, ReviewDecisionKind, ReviewQueue } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

export function useReviewQueue() {
  const { active, isAdmin } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'admin', 'review'),
    queryFn: () => apiFetch<ReviewQueue>('/admin/review'),
    enabled: isAdmin,
  })
}

export function useReviewMutations() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'admin') })
    void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'tasks') })
  }

  const reviewAnswer = useMutation({
    mutationFn: ({ id, ...body }: { id: string; decision: ReviewDecisionKind; notes?: string; correction?: string }) =>
      apiFetch(`/admin/review/answers/${id}`, { method: 'POST', body }),
    onSuccess: (_r, v) => {
      refresh()
      toast.success(v.decision === 'corrected' ? 'Correction recorded' : `Answer ${v.decision}`)
    },
    onError: (err) => toast.error(errorText(err, "The decision couldn't be saved.")),
  })

  const decideAction = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      apiFetch(`/agent/actions/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }),
    onSuccess: (_r, v) => {
      refresh()
      toast.success(v.approve ? 'Approved. The task is on the Tasks page.' : 'Proposal rejected')
    },
    onError: (err) => toast.error(errorText(err, "The proposal couldn't be decided.")),
  })

  return { reviewAnswer, decideAction }
}

export interface AuditFilters {
  actorType: '' | 'user' | 'agent' | 'system'
  action: string
}

export function useAuditLog(filters: AuditFilters) {
  const { active, isAdmin } = useWorkspace()
  return useInfiniteQuery({
    queryKey: wsKey(active?.id, 'admin', 'audit', filters),
    enabled: isAdmin,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' })
      if (filters.actorType) params.set('actor_type', filters.actorType)
      if (filters.action.trim()) params.set('action', filters.action.trim())
      if (pageParam) params.set('before', pageParam)
      return apiFetch<AuditPage>(`/admin/audit?${params}`)
    },
    getNextPageParam: (last) => last.next_before,
  })
}

export function usePipelineHealth(days: number) {
  const { active, isAdmin } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'admin', 'health', days),
    queryFn: () => apiFetch<PipelineHealth>(`/admin/pipeline-health?days=${days}`),
    enabled: isAdmin,
  })
}
