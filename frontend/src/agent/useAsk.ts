import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { AnswerListItem, AskRequest, AskResponse } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

/** The asker's own recent answers in this workspace (GET /agent/answers). */
export function useRecentAnswers() {
  const { active } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'answers'),
    queryFn: () => apiFetch<AnswerListItem[]>('/agent/answers'),
    enabled: Boolean(active?.id),
  })
}

/**
 * Asks the workspace a question. No retry: a question costs model quota, and on
 * the free tier a failed call has usually exhausted the chain already (D-032).
 */
export function useAsk() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AskRequest) => apiFetch<AskResponse>('/agent/ask', { method: 'POST', body }),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'answers') })
    },
  })
}
