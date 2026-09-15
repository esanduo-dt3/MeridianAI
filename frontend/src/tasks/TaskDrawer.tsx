import { useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Robot, Trash, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/Dialog'
import { SelectField, TextField } from '../components/Field'
import { errorText } from '../lib/queryClient'
import type { Priority, Task, TaskStatus } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'
import { QuickAdd } from './QuickAdd'
import { Assignee, DueDate, PriorityIcon, StatusCircle } from './TaskBits'
import { PRIORITIES, priorityLabel, STATUSES, statusLabel } from './taskModel'
import { useRoster, useTaskMutations } from './useTasks'

interface TaskDrawerProps {
  task: Task | null
  allTasks: Task[]
  onClose: () => void
  onOpen: (task: Task) => void
}

const stamp = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function TaskDrawer({ task, allTasks, onClose, onOpen }: TaskDrawerProps) {
  return (
    <RadixDialog.Root open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-[meridian-fade_150ms_ease-out]" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-rule bg-surface shadow-(--shadow-lift) outline-none data-[state=open]:animate-[meridian-slide_220ms_var(--ease-out-quint)]"
        >
          {task && <DrawerBody key={task.id} task={task} allTasks={allTasks} onClose={onClose} onOpen={onOpen} />}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function DrawerBody({ task, allTasks, onClose, onOpen }: { task: Task; allTasks: Task[]; onClose: () => void; onOpen: (task: Task) => void }) {
  const { isAdmin } = useWorkspace()
  const { update, remove } = useTaskMutations()
  const roster = useRoster()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Keep local drafts in step when the saved task changes underneath (e.g. edited elsewhere).
  const [synced, setSynced] = useState({ title: task.title, description: task.description })
  if (synced.title !== task.title || synced.description !== task.description) {
    setSynced({ title: task.title, description: task.description })
    if (synced.title !== task.title) setTitle(task.title)
    if (synced.description !== task.description) setDescription(task.description)
  }

  const parent = task.parent_task_id ? allTasks.find((t) => t.id === task.parent_task_id) : undefined
  const subtasks = allTasks.filter((t) => t.parent_task_id === task.id).sort((a, b) => a.position - b.position)
  const save = (changes: Parameters<typeof update.mutate>[0]['changes']) => update.mutate({ id: task.id, changes })

  function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError('A task needs a title.')
      return
    }
    setTitleError(null)
    if (trimmed !== task.title) save({ title: trimmed })
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b border-rule px-5 py-3">
        {parent ? (
          <button
            type="button"
            onClick={() => onOpen(parent)}
            className="min-w-0 cursor-pointer truncate rounded px-1 text-sm text-ink-3 hover:bg-sunken hover:text-ink"
          >
            ↑ {parent.title}
          </button>
        ) : (
          <span className="text-sm text-ink-3">Task</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete task"
              title="Delete task"
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-danger-wash hover:text-danger"
            >
              <Trash size={17} weight="bold" />
            </button>
          )}
          <RadixDialog.Close aria-label="Close" className="grid size-9 cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink">
            <X size={18} weight="bold" />
          </RadixDialog.Close>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {isAdmin ? (
          <div>
            <label htmlFor="task-title" className="sr-only">
              Title
            </label>
            <textarea
              id="task-title"
              value={title}
              rows={1}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              aria-invalid={titleError ? true : undefined}
              className="field-sizing-content w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 font-display text-[26px] leading-tight font-semibold tracking-[-0.03em] text-ink hover:border-rule focus:border-cobalt focus:outline-none"
            />
            <RadixDialog.Title className="sr-only">{task.title}</RadixDialog.Title>
            {titleError && (
              <p role="alert" className="mt-1 text-[13px] text-danger">
                {titleError}
              </p>
            )}
          </div>
        ) : (
          <RadixDialog.Title className="font-display text-[26px] leading-tight font-semibold tracking-[-0.03em] text-ink">
            {task.title}
          </RadixDialog.Title>
        )}

        {task.source === 'agent' && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-cobalt-wash px-3 py-2 text-sm text-ink-2">
            <Robot aria-hidden size={16} weight="bold" className="shrink-0 text-cobalt" />
            Proposed by the agent and approved by {task.created_by?.full_name || task.created_by?.email || 'an Admin'}.
          </p>
        )}

        <dl className="mt-6 grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
          <dt className="text-ink-3">Status</dt>
          <dd>
            <div role="radiogroup" aria-label="Status" className="inline-flex flex-wrap gap-1 rounded-(--radius-control) border border-rule bg-sunken p-0.5">
              {STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={task.status === value}
                  onClick={() => task.status !== value && save({ status: value as TaskStatus })}
                  className={`inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[6px] px-2.5 text-[13px] transition-colors ${
                    task.status === value ? 'bg-surface font-medium text-ink shadow-(--shadow-hairline)' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  <StatusCircle status={value} title={label} size={12} />
                  {label}
                </button>
              ))}
            </div>
          </dd>

          <dt className="text-ink-3">Priority</dt>
          <dd>
            {isAdmin ? (
              <SelectField label="Priority" hideLabel value={task.priority} onChange={(e) => save({ priority: e.target.value as Priority })} className="min-h-9 w-44 text-sm">
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <PriorityIcon priority={task.priority} />
                {priorityLabel(task.priority)}
              </span>
            )}
          </dd>

          <dt className="text-ink-3">Assignee</dt>
          <dd>
            {isAdmin ? (
              <SelectField
                label="Assignee"
                hideLabel
                value={task.assignee?.id ?? ''}
                disabled={roster.isPending}
                onChange={(e) => save({ assignee_id: e.target.value || null })}
                className="min-h-9 w-60 text-sm"
              >
                <option value="">Unassigned</option>
                {roster.data?.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile.full_name || m.profile.email}
                  </option>
                ))}
              </SelectField>
            ) : (
              <span className="inline-flex items-center gap-2 text-ink">
                <Assignee person={task.assignee} size={22} />
                {task.assignee ? task.assignee.full_name || task.assignee.email : 'Unassigned'}
              </span>
            )}
          </dd>

          <dt className="text-ink-3">Due date</dt>
          <dd>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <TextField
                  label="Due date"
                  hideLabel
                  type="date"
                  value={task.due_date ?? ''}
                  onChange={(e) => save({ due_date: e.target.value || null })}
                  className="min-h-9 w-44 text-sm"
                />
                {task.due_date && (
                  <Button variant="ghost" className="min-h-9 text-sm" onClick={() => save({ due_date: null })}>
                    Clear
                  </Button>
                )}
              </div>
            ) : task.due_date ? (
              <DueDate task={task} />
            ) : (
              <span className="text-ink-3">None</span>
            )}
          </dd>
        </dl>

        <section className="mt-7">
          <h3 className="text-sm font-medium text-ink">Description</h3>
          {isAdmin ? (
            <>
              <label htmlFor="task-description" className="sr-only">
                Description
              </label>
              <textarea
                id="task-description"
                value={description}
                maxLength={10000}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => description !== task.description && save({ description })}
                placeholder="Add context, links or acceptance criteria"
                className="field-sizing-content mt-2 min-h-24 w-full resize-y rounded-(--radius-control) border border-rule bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-3 hover:border-rule-strong focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none"
              />
            </>
          ) : (
            <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-ink-2">{task.description || 'No description.'}</p>
          )}
        </section>

        <section className="mt-7">
          <h3 className="flex items-baseline gap-2 text-sm font-medium text-ink">
            Subtasks
            {subtasks.length > 0 && (
              <span className="font-mono text-xs font-normal text-ink-3 tabular">
                {subtasks.filter((s) => s.status === 'done').length}/{subtasks.length}
              </span>
            )}
          </h3>
          <ul className="mt-2 flex flex-col">
            {subtasks.map((sub) => (
              <li key={sub.id} className="flex min-h-10 items-center gap-1 rounded-(--radius-control) pr-2 hover:bg-sunken">
                <StatusCircle
                  status={sub.status}
                  title={sub.title}
                  onToggle={() => update.mutate({ id: sub.id, changes: { status: sub.status === 'done' ? 'todo' : 'done' } })}
                />
                <button
                  type="button"
                  onClick={() => onOpen(sub)}
                  className={`min-h-10 flex-1 cursor-pointer truncate text-left text-[15px] ${sub.status === 'done' ? 'text-ink-3 line-through' : 'text-ink'}`}
                >
                  {sub.title}
                </button>
                <Assignee person={sub.assignee} size={22} />
              </li>
            ))}
          </ul>
          {isAdmin ? (
            <QuickAdd parentTaskId={task.id} label="Add subtask" className="mt-1" />
          ) : (
            subtasks.length === 0 && <p className="mt-1 text-sm text-ink-3">No subtasks.</p>
          )}
        </section>

        <footer className="mt-8 border-t border-rule pt-4 text-xs leading-relaxed text-ink-3">
          <p>
            {statusLabel(task.status)} · Created {stamp.format(new Date(task.created_at))}
            {task.created_by && ` by ${task.created_by.full_name || task.created_by.email}`}
          </p>
          <p>Updated {stamp.format(new Date(task.updated_at))}</p>
          {!isAdmin && <p className="mt-2">As a Member you can change this task's status. Admins can edit everything else.</p>}
        </footer>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open)
          if (!open) remove.reset()
        }}
        title={`Delete "${task.title}"?`}
        description={
          subtasks.length > 0
            ? `Its ${subtasks.length} ${subtasks.length === 1 ? 'subtask' : 'subtasks'} will be deleted too. This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete task"
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : null}
        onConfirm={() =>
          remove.mutate(task.id, {
            onSuccess: () => {
              setConfirmDelete(false)
              onClose()
              toast.success(`Deleted "${task.title}"`)
            },
          })
        }
      />
    </>
  )
}
