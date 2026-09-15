/* eslint-disable react-refresh/only-export-components -- a Tiptap extension module that renders its own menu */
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import {
  CheckSquare,
  Code,
  ListBullets,
  ListNumbers,
  Minus,
  Quotes,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  type Icon,
} from '@phosphor-icons/react'

interface SlashItem {
  title: string
  hint: string
  keywords: string[]
  icon: Icon
  run: (editor: Editor, range: Range) => void
}

const SLASH_ITEMS: SlashItem[] = [
  { title: 'Text', hint: 'Plain paragraph', keywords: ['paragraph', 'p'], icon: TextT, run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: 'Heading 1', hint: 'Large section heading', keywords: ['h1', 'title'], icon: TextHOne, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: 'Heading 2', hint: 'Medium section heading', keywords: ['h2', 'subtitle'], icon: TextHTwo, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: 'Heading 3', hint: 'Small section heading', keywords: ['h3'], icon: TextHThree, run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: 'Bulleted list', hint: 'A simple list', keywords: ['ul', 'bullet', 'unordered'], icon: ListBullets, run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: 'A list with numbers', keywords: ['ol', 'ordered', 'number'], icon: ListNumbers, run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'To-do list', hint: 'Checkboxes to track items', keywords: ['todo', 'task', 'checkbox', 'check'], icon: CheckSquare, run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Quote', hint: 'Call out a passage', keywords: ['blockquote', 'citation'], icon: Quotes, run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', hint: 'Monospaced code', keywords: ['code', 'snippet', 'pre'], icon: Code, run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', hint: 'Separate sections', keywords: ['hr', 'rule', 'line', 'separator'], icon: Minus, run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
]

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.startsWith(q)))
}

interface MenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const SlashMenu = forwardRef<MenuHandle, SuggestionProps<SlashItem>>(function SlashMenu({ items, command }, ref) {
  const [selected, setSelected] = useState(0)
  // Reset the highlight when the filtered list changes (render-phase adjustment).
  const [previousItems, setPreviousItems] = useState(items)
  if (previousItems !== items) {
    setPreviousItems(items)
    setSelected(0)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + items.length) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'Enter') {
        if (items[selected]) command(items[selected])
        return true
      }
      return false
    },
  }))

  useEffect(() => {
    document.getElementById(`slash-item-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="max-h-80 w-64 overflow-y-auto rounded-(--radius-panel) border border-rule bg-surface p-1.5 shadow-(--shadow-lift)"
    >
      {items.length === 0 ? (
        <p className="px-2.5 py-2 text-sm text-ink-3">No matching blocks</p>
      ) : (
        items.map((item, index) => (
          <button
            key={item.title}
            id={`slash-item-${index}`}
            type="button"
            role="option"
            aria-selected={index === selected}
            onMouseEnter={() => setSelected(index)}
            onClick={() => command(item)}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${index === selected ? 'bg-sunken' : ''}`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-rule bg-paper text-ink-2">
              <item.icon aria-hidden size={16} weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{item.title}</span>
              <span className="block truncate text-xs text-ink-3">{item.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
})

/** Typing "/" at the start of a block opens a filterable block menu. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          return $from.parent.type.name !== 'codeBlock'
        },
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<MenuHandle, SuggestionProps<SlashItem>> | null = null
          let floating: HTMLDivElement | null = null

          const place = (props: SuggestionProps<SlashItem>) => {
            const rect = props.clientRect?.()
            if (!rect || !floating) return
            const virtual = { getBoundingClientRect: () => rect }
            void computePosition(virtual, floating, {
              placement: 'bottom-start',
              strategy: 'fixed',
              middleware: [offset(6), flip(), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              if (floating) Object.assign(floating.style, { left: `${x}px`, top: `${y}px` })
            })
          }

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props, editor: props.editor })
              floating = document.createElement('div')
              floating.style.position = 'fixed'
              floating.style.zIndex = '60'
              floating.appendChild(renderer.element)
              document.body.appendChild(floating)
              place(props)
            },
            onUpdate: (props) => {
              renderer?.updateProps(props)
              place(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                floating?.remove()
                return true
              }
              return renderer?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              floating?.remove()
              renderer?.destroy()
              floating = null
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
