import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Code, LinkSimple, TextB, TextItalic, TextStrikethrough, type Icon } from '@phosphor-icons/react'
import type { BlockDoc, Note } from '../lib/types'
import { SlashCommand } from './slashCommands'

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

interface NoteEditorProps {
  note: Note
  onSave: (changes: { title: string; content: BlockDoc }) => Promise<unknown>
  onStateChange: (state: SaveState) => void
}

const SAVE_DELAY_MS = 700

/**
 * Block editor for a note. The document is a ProseMirror JSON tree, saved as is
 * to notes.content. Changes save automatically after a short pause, and any
 * pending change is flushed when the note closes.
 */
export function NoteEditor({ note, onSave, onStateChange }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const titleRef = useRef(note.title)
  const timer = useRef<number | null>(null)
  const pending = useRef(false)
  const saving = useRef<Promise<unknown> | null>(null)
  const onSaveRef = useRef(onSave)
  const onStateRef = useRef(onStateChange)
  useEffect(() => {
    onSaveRef.current = onSave
    onStateRef.current = onStateChange
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow' } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : "Write, or type '/' for blocks"),
        showOnlyCurrent: true,
      }),
      SlashCommand,
    ],
    content: note.content,
    editorProps: {
      attributes: { class: 'meridian-editor', 'aria-label': 'Note body' },
    },
    onUpdate: () => schedule(),
  })

  function flush() {
    if (!editor || !pending.current) return saving.current
    pending.current = false
    onStateRef.current('saving')
    const request = onSaveRef
      .current({ title: titleRef.current.trim(), content: editor.getJSON() as BlockDoc })
      .then(() => onStateRef.current(pending.current ? 'unsaved' : 'saved'))
      .catch(() => {
        pending.current = true
        onStateRef.current('error')
      })
    saving.current = request
    return request
  }

  function schedule() {
    pending.current = true
    onStateRef.current('unsaved')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  // Save anything pending when the note closes or the tab is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) event.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (timer.current) window.clearTimeout(timer.current)
      void flush()
    }
    // flush reads refs only; re-subscribing on every render would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      strike: e?.isActive('strike') ?? false,
      code: e?.isActive('code') ?? false,
      link: e?.isActive('link') ?? false,
    }),
  })

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Link address', 'https://')
    if (url && /^https?:\/\//i.test(url.trim())) editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      <textarea
        id="note-title"
        value={title}
        rows={1}
        maxLength={200}
        placeholder="Untitled"
        onChange={(event) => {
          setTitle(event.target.value)
          titleRef.current = event.target.value
          schedule()
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === 'ArrowDown') && editor) {
            event.preventDefault()
            // Focus synchronously: the focus() command waits for an animation
            // frame, so fast typing would otherwise keep landing in the title.
            editor.commands.setTextSelection(1)
            editor.view.focus()
          }
        }}
        className="field-sizing-content w-full resize-none bg-transparent font-display text-[34px] leading-tight font-semibold tracking-[-0.035em] text-ink placeholder:text-ink-3/60 focus:outline-none sm:text-[40px]"
      />

      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          className="flex items-center gap-0.5 rounded-(--radius-control) border border-rule bg-surface p-1 shadow-(--shadow-lift)"
        >
          <MarkButton icon={TextB} label="Bold" active={active?.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
          <MarkButton icon={TextItalic} label="Italic" active={active?.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <MarkButton icon={TextStrikethrough} label="Strikethrough" active={active?.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
          <MarkButton icon={Code} label="Inline code" active={active?.code} onClick={() => editor.chain().focus().toggleCode().run()} />
          <MarkButton icon={LinkSimple} label={active?.link ? 'Remove link' : 'Add link'} active={active?.link} onClick={toggleLink} />
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="mt-4" />
    </div>
  )
}

function MarkButton({ icon: Glyph, label, active, onClick }: { icon: Icon; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`grid size-8 cursor-pointer place-items-center rounded-md transition-colors ${
        active ? 'bg-cobalt-wash text-cobalt' : 'text-ink-2 hover:bg-sunken hover:text-ink'
      }`}
    >
      <Glyph aria-hidden size={16} weight="bold" />
    </button>
  )
}
