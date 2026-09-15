import { useState, type FormEvent } from 'react'
import { useWorkspace } from './WorkspaceProvider'
import { Button } from '../components/Button'
import { TextField } from '../components/Field'
import { errorText } from '../lib/queryClient'

interface CreateWorkspaceFormProps {
  submitLabel?: string
  onCreated?: () => void
  onCancel?: () => void
  autoFocus?: boolean
}

export function CreateWorkspaceForm({ submitLabel = 'Create workspace', onCreated, onCancel, autoFocus }: CreateWorkspaceFormProps) {
  const { createWorkspace, creating } = useWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the workspace a name.')
      return
    }
    setError(null)
    try {
      await createWorkspace(trimmed)
      setName('')
      onCreated?.()
    } catch (err) {
      setError(errorText(err, "The workspace couldn't be created. Try again."))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Workspace name"
        placeholder="e.g. Product research"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        autoFocus={autoFocus}
        autoComplete="off"
        hint="You'll be its Admin. You can rename it later."
        error={error}
      />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={creating}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={creating}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
