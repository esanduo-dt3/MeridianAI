import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Plus } from '@phosphor-icons/react'
import type { TaskStatus } from '../lib/types'
import { useTaskMutations } from './useTasks'

interface QuickAddProps {
  parentTaskId?: string | null
  status?: TaskStatus
  label?: string
  /** Opens the composer when the page-level "n" shortcut fires. */
  shortcut?: boolean
  className?: string
}

/** Inline composer: type a title, Enter to add and keep going, Escape to close. */
export function QuickAdd({ parentTaskId = null, status = 'todo', label = 'Add task', shortcut = false, className = '' }: QuickAddProps) {
  const { create } = useTaskMutations()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!shortcut) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return
      if (target.closest('input, textarea, select, [contenteditable=true], [role=dialog]')) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate(
      { title: trimmed, status, parent_task_id: parentTaskId },
      { onSuccess: () => setTitle('') },
    )
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      setTitle('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-2 text-left text-sm text-ink-3 transition-colors hover:bg-sunken hover:text-ink ${className}`}
      >
        <span className="grid size-7 place-items-center">
          <span className="grid size-[18px] place-items-center rounded-full border-[1.5px] border-dashed border-rule-strong group-hover:border-ink-3">
            <Plus aria-hidden size={10} weight="bold" />
          </span>
        </span>
        {label}
        {shortcut && (
          <kbd className="ml-auto rounded border border-rule px-1.5 font-mono text-[11px] text-ink-3" aria-label="Shortcut: N">
            N
          </kbd>
        )}
      </button>
    )
  }

  return (
    <div className={`flex min-h-10 items-center gap-2.5 rounded-(--radius-control) border border-cobalt bg-surface px-2 shadow-[0_0_0_3px_var(--color-cobalt-wash)] ${className}`}>
      <span className="grid size-7 place-items-center">
        <span className="size-[18px] rounded-full border-[1.5px] border-rule-strong" />
      </span>
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!title.trim()) setOpen(false)
        }}
        maxLength={200}
        placeholder={parentTaskId ? 'Subtask title' : 'Task title'}
        aria-label={parentTaskId ? 'New subtask title' : 'New task title'}
        className="min-h-10 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
      />
      <span className="hidden font-mono text-[11px] text-ink-3 sm:inline">{create.isPending ? 'Adding…' : 'Enter to add · Esc to close'}</span>
    </div>
  )
}
