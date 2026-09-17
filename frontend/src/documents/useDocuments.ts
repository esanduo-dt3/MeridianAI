import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '../lib/api'
import { errorText } from '../lib/queryClient'
import type { DocumentDetail, DocumentSummary } from '../lib/types'
import { useWorkspace, wsKey } from '../workspace/WorkspaceProvider'

const inFlight = (docs: DocumentSummary[] | undefined) =>
  Boolean(docs?.some((d) => d.parsed_status === 'pending' || d.parsed_status === 'processing'))

export function useDocuments() {
  const { active } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'documents'),
    queryFn: () => apiFetch<DocumentSummary[]>('/documents'),
    // Poll only while something is still being processed.
    refetchInterval: (query) => (inFlight(query.state.data) ? 2000 : false),
  })
}

export function useDocument(id: string | undefined) {
  const { active } = useWorkspace()
  return useQuery({
    queryKey: wsKey(active?.id, 'document', id),
    queryFn: () => apiFetch<DocumentDetail>(`/documents/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.parsed_status
      return status === 'pending' || status === 'processing' ? 2000 : false
    },
  })
}

export function useDocumentMutations() {
  const { active, workspaces } = useWorkspace()
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: wsKey(active?.id, 'documents') })

  const upload = useMutation({
    mutationFn: ({ file, workspaceId }: { file: File; workspaceId: string }) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<DocumentSummary>('/documents/upload', { method: 'POST', body: form, workspaceId })
    },
    onSuccess: (doc, { workspaceId }) => {
      if (workspaceId === active?.id) {
        queryClient.setQueryData<DocumentSummary[]>(wsKey(active?.id, 'documents'), (docs) => [doc, ...(docs ?? [])])
        toast.success(`Uploaded ${doc.file_name}. Processing has started.`)
      } else {
        const name = workspaces.find((w) => w.id === workspaceId)?.name ?? 'the other workspace'
        toast.success(`Uploaded ${doc.file_name} to ${name}.`)
      }
    },
    onError: (err, { file }) => toast.error(`${file.name}: ${errorText(err, "the upload didn't finish.")}`),
  })

  const reprocess = useMutation({
    mutationFn: (id: string) => apiFetch<DocumentSummary>(`/documents/${id}/reprocess`, { method: 'POST' }),
    onSuccess: (doc) => {
      void refresh()
      toast.success(`Processing ${doc.file_name} again`)
    },
    onError: (err) => toast.error(errorText(err, "The document couldn't be reprocessed.")),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
  })

  return { upload, reprocess, remove }
}
