import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { errorText } from '../lib/queryClient'
import type { Roster, Task, TaskBoard, TaskInput } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

export function useTaskBoard() {
  const { active } = useWorkspace()
  return useQuery({ queryKey: wsKey(active?.id, 'tasks'), queryFn: () => apiFetch<TaskBoard>('/tasks') })
}

export function useRoster() {
  const { active } = useWorkspace()
  return useQuery({ queryKey: wsKey(active?.id, 'members'), queryFn: () => apiFetch<Roster>('/members') })
}

export function useTaskMutations() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const key = wsKey(active?.id, 'tasks')

  const patchCache = (updater: (board: TaskBoard) => TaskBoard) =>
    queryClient.setQueryData<TaskBoard>(key, (board) => (board ? updater(board) : board))

  const create = useMutation({
    mutationFn: (input: TaskInput & { title: string }) => apiFetch<Task>('/tasks', { method: 'POST', body: input }),
    onSuccess: (task) => patchCache((board) => ({ ...board, tasks: [...board.tasks, task] })),
    onError: (err) => toast.error(errorText(err, "The task couldn't be created.")),
  })

  // Optimistic: the change shows immediately and is rolled back if the API refuses it.
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: TaskInput }) =>
      apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: changes }),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TaskBoard>(key)
      patchCache((board) => ({
        ...board,
        tasks: board.tasks.map((task) => {
          if (task.id !== id) return task
          // assignee_id is resolved to a profile by the server response.
          const rest: TaskInput = { ...changes }
          delete rest.assignee_id
          return { ...task, ...(rest as Partial<Task>) }
        }),
      }))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(errorText(err, "That change couldn't be saved."))
    },
    onSuccess: (task) => patchCache((board) => ({ ...board, tasks: board.tasks.map((t) => (t.id === task.id ? task : t)) })),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  const approve = useMutation({
    mutationFn: (proposalId: string) => apiFetch<Task>(`/agent/actions/${proposalId}/approve`, { method: 'POST' }),
    onSuccess: (task, proposalId) => {
      patchCache((board) => ({
        tasks: [...board.tasks, task],
        proposals: board.proposals.filter((p) => p.id !== proposalId),
      }))
      toast.success(`Approved. "${task.title}" was added to tasks.`)
    },
    onError: (err) => {
      toast.error(errorText(err, "The proposal couldn't be approved."))
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })

  const reject = useMutation({
    mutationFn: (proposalId: string) => apiFetch<{ id: string }>(`/agent/actions/${proposalId}/reject`, { method: 'POST' }),
    onSuccess: (_result, proposalId) => {
      patchCache((board) => ({ ...board, proposals: board.proposals.filter((p) => p.id !== proposalId) }))
      toast.success('Rejected. Nothing was added.')
    },
    onError: (err) => {
      toast.error(errorText(err, "The proposal couldn't be rejected."))
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return { create, update, remove, approve, reject }
}
