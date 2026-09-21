import { useState, type FormEvent } from 'react'
import { Flag, Plus, SlidersHorizontal, Trash } from '@phosphor-icons/react'
import { Button } from '../components/Button'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { TextField } from '../components/Field'
import type { Sprint, SprintBoard, Task } from '../lib/types'
import { scopeTasks, type Scope } from './taskModel'
import { useSprintMutations } from './useSprints'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

function sprintDates(sprint: Sprint): string | null {
  if (!sprint.start_date && !sprint.end_date) return null
  const from = sprint.start_date ? dateFormat.format(new Date(sprint.start_date)) : '?'
  const to = sprint.end_date ? dateFormat.format(new Date(sprint.end_date)) : '?'
  return `${from} – ${to}`
}

const statusText = (sprint: Sprint) =>
  sprint.status === 'active' ? 'In progress' : sprint.status === 'planned' ? 'Planned' : 'Complete'

// PUBLIC_INTERFACE
export function SprintBar({
  board,
  tasks,
  scope,
  onScope,
  canManage,
}: {
  board: SprintBoard | undefined
  tasks: Task[]
  scope: Scope
  onScope: (scope: Scope) => void
  canManage: boolean
}) {
  /**
   * Renders the sprint scope control as a single non-wrapping strip.
   *
   * The strip lives inside the Tasks command bar, so it must never add a row: sprint
   * management is therefore reached through an explicit disclosure that opens a focus-trapped
   * surface instead of expanding a second band underneath the scope tabs.
   *
   * The module path, export name and prop contract (`board`, `tasks`, `scope`, `onScope`,
   * `canManage`) are deliberately unchanged so existing callers and test doubles keep working.
   */
  const sprints = board?.sprints ?? []
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const selected = sprints.find((sprint) => sprint.id === scope) ?? null

  const count = (value: Scope) => scopeTasks(tasks, value).filter((task) => task.status !== 'done').length
  const tabs: { value: Scope; label: string; hint: string }[] = [
    { value: 'all', label: 'All work', hint: 'Every task in the workspace' },
    { value: 'backlog', label: 'Backlog', hint: 'Not in a sprint yet' },
    ...sprints
      .filter((sprint) => sprint.status !== 'completed')
      .map((sprint) => ({ value: sprint.id, label: sprint.name, hint: sprintDates(sprint) ?? 'No dates set' })),
  ]

  return (
    <div className="flex min-w-max items-center gap-1.5">
      <div role="tablist" aria-label="Sprint" className="flex items-center gap-1">
        {tabs.map(({ value, label, hint }) => {
          const on = scope === value
          const isActiveSprint = value === board?.active_sprint_id
          return (
            <button
              key={value}
              role="tab"
              aria-selected={on}
              title={hint}
              onClick={() => onScope(value)}
              className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-(--radius-control) border px-3 text-sm whitespace-nowrap transition-colors ${
                on
                  ? 'border-rule-strong bg-surface font-medium text-ink'
                  : 'border-transparent text-ink-2 hover:bg-[var(--glass-raised)] hover:text-ink'
              }`}
            >
              {isActiveSprint && <span aria-hidden className="size-1.5 rounded-full bg-cobalt" />}
              {label}
              <span className="font-mono text-xs text-ink-3">{count(value)}</span>
            </button>
          )
        })}
      </div>

      {selected && canManage && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={managing}
          onClick={() => setManaging(true)}
          title={`Manage ${selected.name}`}
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-(--radius-control) border border-transparent px-2.5 text-sm whitespace-nowrap text-ink-2 transition-colors hover:bg-[var(--glass-raised)] hover:text-ink"
        >
          <SlidersHorizontal size={15} weight="bold" aria-hidden /> Manage sprint
        </button>
      )}

      {canManage && (
        <Button variant="ghost" onClick={() => setCreating(true)} className="min-h-9 shrink-0 px-2.5 text-sm">
          <Plus size={15} weight="bold" aria-hidden /> New sprint
        </Button>
      )}

      {selected && canManage && (
        <SprintManagement
          sprint={selected}
          open={managing}
          onOpenChange={setManaging}
          onDeleted={() => {
            setManaging(false)
            onScope('backlog')
          }}
        />
      )}

      <NewSprintDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

/**
 * Sprint lifecycle and deletion for the selected sprint.
 *
 * Rendered as a focus-trapped surface rather than an inline band: the scope strip sits inside a
 * horizontally scrolling command-bar row, so an inline disclosure would either be clipped or
 * force the command bar to a third row.
 */
function SprintManagement({
  sprint,
  open,
  onOpenChange,
  onDeleted,
}: {
  sprint: Sprint
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const { update, remove } = useSprintMutations()
  const [confirming, setConfirming] = useState(false)
  const dates = sprintDates(sprint)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Manage ${sprint.name}`}
        description="Starting or completing a sprint changes only its status. Deleting it returns its tasks to the backlog."
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-(--radius-panel) border border-rule bg-sunken px-3 py-2">
            <Flag size={16} weight="bold" aria-hidden className="shrink-0 text-ink-3" />
            <p className="text-sm text-ink-2">
              <span className="font-medium text-ink">{sprint.name}</span>
              {dates && <span className="text-ink-3"> · {dates}</span>}
              <span className="text-ink-3"> · {statusText(sprint)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sprint.status === 'planned' && (
              <Button
                variant="secondary"
                loading={update.isPending}
                onClick={() => update.mutate({ id: sprint.id, changes: { status: 'active' } })}
              >
                Start sprint
              </Button>
            )}
            {sprint.status === 'active' && (
              <Button
                variant="secondary"
                loading={update.isPending}
                onClick={() => update.mutate({ id: sprint.id, changes: { status: 'completed' } })}
              >
                Complete sprint
              </Button>
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${sprint.name}`}
              title="Delete sprint"
              className="ml-auto grid size-11 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-danger-wash hover:text-danger"
            >
              <Trash size={16} weight="bold" />
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${sprint.name}?`}
        description="Its tasks are not deleted: they go back to the backlog."
        confirmLabel="Delete sprint"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(sprint.id, {
            onSuccess: () => {
              setConfirming(false)
              onDeleted()
            },
          })
        }
      />
    </>
  )
}

function NewSprintDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { create } = useSprintMutations()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const reset = () => {
    setName('')
    setStart('')
    setEnd('')
  }

  const datesBackwards = Boolean(start && end && end < start)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || datesBackwards) return
    create.mutate(
      { name: name.trim(), start_date: start || null, end_date: end || null },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="New sprint"
      description="A sprint is a dated slice of the backlog. Tasks stay in the backlog until you move them in."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button form="new-sprint" type="submit" loading={create.isPending} disabled={!name.trim() || datesBackwards}>
            Create sprint
          </Button>
        </>
      }
    >
      <form id="new-sprint" onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          autoFocus
          placeholder="Sprint 1"
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <TextField
            label="Starts"
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            wrapperClassName="flex-1"
          />
          <TextField
            label="Ends"
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            error={datesBackwards ? 'A sprint cannot end before it starts.' : undefined}
            wrapperClassName="flex-1"
          />
        </div>
      </form>
    </Dialog>
  )
}
