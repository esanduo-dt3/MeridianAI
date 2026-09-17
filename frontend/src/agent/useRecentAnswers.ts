import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { AnswerListItem } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

/** The asker's own recent checked answers in this workspace (GET /agent/answers). */
export function useRecentAnswers() {
  const { active } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'answers'),
    queryFn: () => apiFetch<AnswerListItem[]>('/agent/answers'),
    enabled: Boolean(active?.id),
  })
}
