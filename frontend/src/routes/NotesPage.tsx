import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, CircleNotch, MagnifyingGlass, NotePencil, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { errorText } from '../lib/queryClient'
import { NoteEditor, type SaveState } from '../notes/NoteEditor'
import { useNote, useNoteMutations, useNotesList } from '../notes/useNotes'
import { useWorkspace } from '../workspace/WorkspaceProvider'

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
function ago(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function NotesPage() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const notes = useNotesList()
  const { create } = useNoteMutations()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes.data ?? []).filter((n) => !q || n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q))
  }, [notes.data, query])

  function newNote() {
    create.mutate(undefined, {
      onSuccess: (note) => navigate(`/notes/${note.id}`),
      onError: (err) => toast.error(errorText(err, "The note couldn't be created.")),
    })
  }

  return (
    <div className="-my-8 flex min-h-[calc(100dvh-3.5rem)] flex-col lg:-my-12 lg:min-h-dvh lg:flex-row">
      <aside
        className={`flex flex-col border-rule py-6 lg:w-72 lg:shrink-0 lg:border-r lg:py-10 lg:pr-5 ${noteId ? 'hidden lg:flex' : 'flex'}`}
        aria-label="Notes"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink">Notes</h1>
          <Button onClick={newNote} loading={create.isPending} className="min-h-9 px-3 text-sm" leading={<Plus aria-hidden size={15} weight="bold" />}>
            New
          </Button>
        </div>
        <div className="relative mt-4">
          <MagnifyingGlass aria-hidden size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <label htmlFor="note-search" className="sr-only">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            className="min-h-10 w-full rounded-(--radius-control) border border-rule bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none"
          />
        </div>

        <div className="mt-4 flex-1">
          {notes.isPending ? (
            <div className="flex flex-col gap-2" role="status" aria-label="Loading notes">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : notes.isError ? (
            <ErrorState title="Notes couldn't be loaded" message={errorText(notes.error)} onRetry={() => void notes.refetch()} />
          ) : filtered.length === 0 ? (
            <p className="px-1 py-6 text-sm text-ink-3">{query ? `No notes match "${query}".` : 'No notes yet.'}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((note) => (
                <li key={note.id}>
                  <Link
                    to={`/notes/${note.id}`}
                    aria-current={note.id === noteId ? 'page' : undefined}
                    className={`block rounded-(--radius-control) px-3 py-2.5 transition-colors ${
                      note.id === noteId ? 'bg-surface shadow-(--shadow-hairline)' : 'hover:bg-sunken'
                    }`}
                  >
                    <span className="block truncate text-sm font-medium text-ink">{note.title || 'Untitled'}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">
                      {ago(note.updated_at)}
                      {note.preview ? ` · ${note.preview}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={`min-w-0 flex-1 py-6 lg:py-10 lg:pl-10 ${noteId ? 'block' : 'hidden lg:block'}`}>
        {noteId ? (
          <OpenNote key={noteId} noteId={noteId} />
        ) : (
          <div className="mx-auto max-w-lg pt-10">
            <EmptyState
              icon={NotePencil}
              title={notes.data?.length ? 'Pick a note' : 'Start your first note'}
              action={
                <Button onClick={newNote} loading={create.isPending} leading={<Plus aria-hidden size={16} weight="bold" />}>
                  New note
                </Button>
              }
            >
              Notes are built from blocks: headings, lists, to-dos, quotes and code. Type / in a note to add one.
            </EmptyState>
          </div>
        )}
      </section>
    </div>
  )
}

function OpenNote({ noteId }: { noteId: string }) {
  const note = useNote(noteId)
  const { save, remove } = useNoteMutations()
  const { user } = useAuth()
  const { isAdmin } = useWorkspace()
  const navigate = useNavigate()
  const [state, setState] = useState<SaveState>('saved')
  const [confirming, setConfirming] = useState(false)

  if (note.isPending) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4" role="status" aria-label="Loading note">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }
  if (note.isError) {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorState title="This note couldn't be opened" message={errorText(note.error)} onRetry={() => void note.refetch()} />
      </div>
    )
  }

  const canDelete = isAdmin || note.data.created_by?.id === user?.id

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
        <Link to="/notes" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink lg:hidden">
          <ArrowLeft aria-hidden size={14} weight="bold" />
          Notes
        </Link>
        <SaveIndicator state={state} />
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Delete note"
            title="Delete note"
            className="ml-auto grid size-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-danger-wash hover:text-danger"
          >
            <Trash size={17} weight="bold" />
          </button>
        )}
      </div>

      <NoteEditor
        note={note.data}
        onStateChange={setState}
        onSave={({ title, content }) => save.mutateAsync({ id: noteId, title, content })}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) remove.reset()
        }}
        title={`Delete "${note.data.title || 'Untitled'}"?`}
        description="The note is removed for everyone in the workspace. This can't be undone."
        confirmLabel="Delete note"
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : null}
        onConfirm={() =>
          remove.mutate(noteId, {
            onSuccess: () => {
              setConfirming(false)
              navigate('/notes')
              toast.success('Note deleted')
            },
          })
        }
      />
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const content = {
    saved: { icon: <CheckCircle aria-hidden size={14} weight="fill" className="text-grounded" />, text: 'Saved' },
    saving: { icon: <CircleNotch aria-hidden size={14} weight="bold" className="animate-spin" />, text: 'Saving…' },
    unsaved: { icon: <CircleNotch aria-hidden size={14} weight="bold" className="opacity-40" />, text: 'Editing' },
    error: { icon: <WarningCircle aria-hidden size={14} weight="fill" className="text-danger" />, text: "Couldn't save. Retrying when you type" },
  }[state]
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-ink-3">
      {content.icon}
      {content.text}
    </span>
  )
}
