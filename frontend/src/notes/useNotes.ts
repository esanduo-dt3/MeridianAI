import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import type { BlockDoc, Note, NoteSummary } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

export function useNotesList() {
  const { active } = useWorkspace()
  return useQuery({ queryKey: wsKey(active?.id, 'notes'), queryFn: () => apiFetch<NoteSummary[]>('/notes') })
}

export function useNote(id: string | undefined) {
  const { active } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'note', id),
    queryFn: () => apiFetch<Note>(`/notes/${id}`),
    enabled: Boolean(id),
    // The open editor owns the content; refetching would reset the cursor.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useNoteMutations() {
  const { active } = useWorkspace()
  const queryClient = useQueryClient()
  const listKey = wsKey(active?.id, 'notes')

  const upsertSummary = (note: Note) =>
    queryClient.setQueryData<NoteSummary[]>(listKey, (notes) => {
      const summary: NoteSummary = { ...note }
      const others = (notes ?? []).filter((n) => n.id !== note.id)
      return [summary, ...others]
    })

  const create = useMutation({
    mutationFn: () => apiFetch<Note>('/notes', { method: 'POST', body: {} }),
    onSuccess: (note) => {
      queryClient.setQueryData(wsKey(active?.id, 'note', note.id), note)
      upsertSummary(note)
    },
  })

  const save = useMutation({
    mutationFn: ({ id, title, content }: { id: string; title?: string; content?: BlockDoc }) =>
      apiFetch<Note>(`/notes/${id}`, { method: 'PATCH', body: { title, content } }),
    onSuccess: upsertSummary,
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<NoteSummary[]>(listKey, (notes) => (notes ?? []).filter((n) => n.id !== id))
      queryClient.removeQueries({ queryKey: wsKey(active?.id, 'note', id) })
    },
  })

  return { create, save, remove }
}
