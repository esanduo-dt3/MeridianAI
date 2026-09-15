import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { CaretUpDown, Check, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Dialog } from '../components/Dialog'
import { RoleBadge } from '../components/Feedback'
import { CreateWorkspaceForm } from './CreateWorkspaceForm'
import { useWorkspace } from './WorkspaceProvider'

function Monogram({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-lg bg-ink font-display text-[15px] font-semibold text-on-ink"
    >
      {name.trim().charAt(0).toUpperCase() || 'W'}
    </span>
  )
}

export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { workspaces, active, switchWorkspace } = useWorkspace()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  if (!active) return null

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          className="group flex w-full cursor-pointer items-center gap-3 rounded-(--radius-control) border border-rule bg-surface px-2.5 py-2 text-left shadow-(--shadow-hairline) transition-colors hover:border-rule-strong data-[state=open]:border-rule-strong"
          aria-label={`Workspace: ${active.name}. Switch workspace`}
        >
          <Monogram name={active.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{active.name}</span>
            <span className="block text-xs text-ink-3">
              {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
            </span>
          </span>
          <CaretUpDown aria-hidden size={16} weight="bold" className="text-ink-3 group-hover:text-ink-2" />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-(--radius-panel) border border-rule bg-surface p-1.5 shadow-(--shadow-lift) data-[state=open]:animate-[meridian-fade_120ms_ease-out]"
          >
            <Menu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-3">Workspaces</Menu.Label>
            <div className="max-h-72 overflow-y-auto">
              {workspaces.map((workspace) => (
                <Menu.Item
                  key={workspace.id}
                  onSelect={() => {
                    if (workspace.id === active.id) return
                    switchWorkspace(workspace.id)
                    onNavigate?.()
                    navigate('/tasks')
                    toast.success(`Switched to ${workspace.name}`)
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-sunken"
                >
                  <Monogram name={workspace.name} size={24} />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  <RoleBadge role={workspace.auth_role} />
                  <Check aria-hidden size={14} weight="bold" className={workspace.id === active.id ? 'text-cobalt' : 'invisible'} />
                </Menu.Item>
              ))}
            </div>
            <Menu.Separator className="my-1.5 h-px bg-rule" />
            <Menu.Item
              onSelect={() => setCreating(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-sunken data-[highlighted]:text-ink"
            >
              <span className="grid size-6 place-items-center rounded-md border border-dashed border-rule-strong">
                <Plus aria-hidden size={12} weight="bold" />
              </span>
              Create workspace
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Create a workspace"
        description="Workspaces keep documents, notes and tasks separate, each with its own members."
      >
        <CreateWorkspaceForm
          autoFocus
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            onNavigate?.()
            navigate('/tasks')
            toast.success('Workspace created. You are its Admin.')
          }}
        />
      </Dialog>
    </>
  )
}
