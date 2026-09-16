import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { ChatResponse, ChatTurn } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

/**
 * One message to the workspace agent. The conversation lives in the page and is
 * sent back each time; the server keeps no chat state beyond the audit log.
 * No retry: each message spends model quota (D-032).
 */
export function useAgentChat() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: { message: string; history: ChatTurn[] }) =>
      apiFetch<ChatResponse>('/agent/chat', { method: 'POST', body }),
    retry: false,
    onSuccess: (response) => {
      // A proposal appears in the Tasks page's approval panel straight away.
      if (response.proposals.length > 0) {
        void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'tasks') })
      }
    },
  })
}
