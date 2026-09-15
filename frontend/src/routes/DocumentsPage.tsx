import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  FilePdf,
  FileText,
  Files,
  MagnifyingGlass,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { SelectField } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { ProgressBar } from '../documents/IngestProgress'
import { embeddingFraction, stageLabel } from '../documents/ingestState'
import { useDocumentMutations, useDocuments } from '../documents/useDocuments'
import { formatBytes } from '../lib/format'
import { errorText } from '../lib/queryClient'
import type { DocumentSummary } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_BYTES = 25 * 1024 * 1024
const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export function DocumentsPage() {
  const { active, workspaces } = useWorkspace()
  const docs = useDocuments()
  const adminWorkspaces = workspaces.filter((w) => w.auth_role === 'Admin')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Documents"
        description={`PDF and Word files in ${active?.name}, split into passages the agent can cite down to the character.`}
      />

      {adminWorkspaces.length > 0 && <UploadPanel />}

      {docs.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading documents">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-(--radius-panel)" />
          ))}
        </div>
      ) : docs.isError ? (
        <ErrorState title="Documents couldn't be loaded" message={errorText(docs.error)} onRetry={() => void docs.refetch()} />
      ) : docs.data.length === 0 ? (
        <EmptyState icon={Files} title="No documents yet">
          {adminWorkspaces.some((w) => w.id === active?.id)
            ? 'Upload a PDF or Word file above. When it shows Ready, members can ask questions about it.'
            : 'When an Admin uploads documents to this workspace, they appear here.'}
        </EmptyState>
      ) : (
        <DocumentList docs={docs.data} />
      )}
    </div>
  )
}

function UploadPanel() {
  const { active, workspaces } = useWorkspace()
  const { upload } = useDocumentMutations()
  const adminWorkspaces = workspaces.filter((w) => w.auth_role === 'Admin')
  const [target, setTarget] = useState(() =>
    adminWorkspaces.some((w) => w.id === active?.id) ? active!.id : (adminWorkspaces[0]?.id ?? ''),
  )
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function send(files: File[]) {
    const valid = files.filter((file) => {
      const ok = /\.(pdf|docx)$/i.test(file.name)
      if (!ok) toast.error(`${file.name}: only PDF and Word (.docx) files can be uploaded.`)
      else if (file.size > MAX_BYTES) toast.error(`${file.name}: the file is larger than 25 MB.`)
      return ok && file.size <= MAX_BYTES
    })
    for (const file of valid) {
      setUploading((names) => [...names, file.name])
      try {
        await upload.mutateAsync({ file, workspaceId: target })
      } catch {
        // Reported by the mutation's onError toast.
      } finally {
        setUploading((names) => names.filter((n) => n !== file.name))
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    void send(Array.from(event.dataTransfer.files))
  }

  return (
    <section aria-label="Upload documents" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-(--radius-panel) border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragging ? 'border-cobalt bg-cobalt-wash/60' : 'border-rule-strong bg-surface/60'
        }`}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-sunken text-ink-2">
          <CloudArrowUp aria-hidden size={24} weight="duotone" />
        </span>
        <div>
          <p className="font-medium text-ink">Drop PDF or Word files here</p>
          <p className="mt-0.5 text-sm text-ink-3">Up to 25 MB each. Text is extracted, split into passages and indexed for search.</p>
        </div>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={!target}>
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Choose PDF or Word files to upload"
          onChange={(event) => {
            void send(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        {uploading.length > 0 && (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-2">
            <CircleNotch aria-hidden size={16} className="animate-spin" />
            Uploading {uploading[0]}
            {uploading.length > 1 ? ` and ${uploading.length - 1} more` : ''}…
          </p>
        )}
      </div>

      <div className="flex flex-col justify-center gap-2 rounded-(--radius-panel) border border-rule bg-surface p-5">
        <SelectField
          label="Upload to"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          hint="The workspace whose members can search these documents."
        >
          {adminWorkspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </SelectField>
      </div>
    </section>
  )
}

function StatusBadge({ doc }: { doc: DocumentSummary }) {
  switch (doc.parsed_status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-grounded-wash px-2 py-0.5 text-xs font-medium text-grounded">
          <CheckCircle aria-hidden size={13} weight="fill" />
          Ready
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-wash px-2 py-0.5 text-xs font-medium text-danger">
          <WarningCircle aria-hidden size={13} weight="fill" />
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-cobalt-wash px-2 py-0.5 text-xs font-medium text-cobalt">
          <CircleNotch aria-hidden size={13} weight="bold" className="animate-spin" />
          <span className="tabular">{stageLabel(doc)}</span>
        </span>
      )
  }
}

function DocumentList({ docs }: { docs: DocumentSummary[] }) {
  const { isAdmin } = useWorkspace()
  const { reprocess, remove } = useDocumentMutations()
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null)

  return (
    <section aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="mb-3 text-sm font-medium text-ink-2">
        {docs.length} {docs.length === 1 ? 'document' : 'documents'} ·{' '}
        {docs.filter((d) => d.parsed_status === 'ready').reduce((sum, d) => sum + d.chunk_count, 0)} passages searchable
      </h2>
      <ul className="divide-y divide-rule overflow-hidden rounded-(--radius-panel) border border-rule bg-surface">
        {docs.map((doc) => {
          const Icon = doc.doc_type === 'pdf' ? FilePdf : FileText
          // Passages can be previewed as soon as they are saved, before embedding finishes.
          const inspectable = doc.chunk_count > 0 && doc.parsed_status !== 'pending'
          const embedding = doc.parsed_status === 'processing' && doc.processing_stage === 'embedding'
          return (
            <li key={doc.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
                <Icon aria-hidden size={20} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {inspectable ? (
                    <Link to={`/documents/${doc.id}`} className="truncate font-medium text-ink hover:text-cobalt hover:underline">
                      {doc.file_name}
                    </Link>
                  ) : (
                    <span className="truncate font-medium text-ink">{doc.file_name}</span>
                  )}
                  <StatusBadge doc={doc} />
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-3">
                  {[
                    formatBytes(doc.size_bytes),
                    doc.page_count ? `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}` : null,
                    doc.chunk_count > 0 ? `${doc.chunk_count} passages` : null,
                    doc.uploaded_by ? `by ${doc.uploaded_by.full_name || doc.uploaded_by.email}` : null,
                    dateFormat.format(new Date(doc.created_at)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {embedding && (
                  <ProgressBar value={embeddingFraction(doc)} label={`Embedding ${doc.file_name}`} className="mt-2 max-w-sm" />
                )}
                {doc.parsed_status === 'failed' && doc.parse_error && (
                  <p className="mt-1 text-sm text-danger">{doc.parse_error}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {inspectable && (
                  <Link
                    to={`/documents/${doc.id}`}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink"
                  >
                    <MagnifyingGlass aria-hidden size={16} weight="bold" />
                    {doc.parsed_status === 'ready' ? 'Inspect' : 'Preview'}
                  </Link>
                )}
                {isAdmin && doc.parsed_status === 'failed' && (
                  <Button
                    variant="ghost"
                    className="min-h-10 text-sm"
                    loading={reprocess.isPending && reprocess.variables === doc.id}
                    onClick={() => reprocess.mutate(doc.id)}
                    leading={<ArrowClockwise aria-hidden size={16} weight="bold" />}
                  >
                    Retry
                  </Button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeleting(doc)}
                    aria-label={`Delete ${doc.file_name}`}
                    title="Delete document"
                    className="grid size-10 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-danger-wash hover:text-danger"
                  >
                    <Trash size={17} weight="bold" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={`Delete ${deleting?.file_name}?`}
        description="Its passages are removed from search, and past answers lose these citations. This can't be undone."
        confirmLabel="Delete document"
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : null}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`Deleted ${deleting.file_name}`)
              setDeleting(null)
            },
          })
        }
      />
    </section>
  )
}
