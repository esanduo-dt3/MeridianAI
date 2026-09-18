import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { errorText } from '../lib/queryClient'
import type { Sprint, SprintBoard, SprintInput } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

/** Sprints for the workspace, newest first, with whichever one is active (D-048). */
export function useSprints() {
  const { active } = useWorkspace()
  return useQuery({ queryKey: wsKey(active?.id, 'sprints'), queryFn: () => apiFetch<SprintBoard>('/sprints') })
}

export function useSprintMutations() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const key = wsKey(active?.id, 'sprints')
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const create = useMutation({
    mutationFn: (input: SprintInput & { name: string }) =>
      apiFetch<Sprint>('/admin/sprints', { method: 'POST', body: input }),
    onSuccess: (sprint) => {
      void refresh()
      toast.success(`${sprint.name} created`)
    },
    onError: (err) => toast.error(errorText(err, "The sprint couldn't be created.")),
  })

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: SprintInput }) =>
      apiFetch<Sprint>(`/admin/sprints/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: (sprint, { changes }) => {
      void refresh()
      if (changes.status === 'active') toast.success(`${sprint.name} is now in progress`)
      if (changes.status === 'completed') toast.success(`${sprint.name} is complete`)
    },
    // A second active sprint is refused by the database, and says so plainly.
    onError: (err) => toast.error(errorText(err, "The sprint couldn't be updated.")),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/admin/sprints/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void refresh()
      // Its tasks are not deleted with it; they go back to the backlog.
      void queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'tasks') })
      toast.success('Sprint deleted. Its tasks went back to the backlog.')
    },
    onError: (err) => toast.error(errorText(err, "The sprint couldn't be deleted.")),
  })

  return { create, update, remove }
}
