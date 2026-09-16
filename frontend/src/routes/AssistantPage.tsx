import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Clock,
  MagnifyingGlass,
  PaperPlaneTilt,
  Robot,
  ShieldWarning,
  UsersThree,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { AnswerText } from '../agent/AnswerText'
import { useAgentChat } from '../agent/useAgentChat'
import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { errorText } from '../lib/queryClient'
import type { AgentProposal, AgentStep, ChatResponse, ChatTurn } from '../lib/types'
import { PriorityIcon } from '../tasks/TaskBits'
import { formatDue } from '../tasks/taskModel'
import { useWorkspace } from '../workspace/WorkspaceProvider'

const MAX_MESSAGE_CHARS = 2000

const SUGGESTIONS = ['What do I have to do?', 'What is overdue in this workspace?', 'Which tasks are unassigned?']

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  response?: ChatResponse
  failed?: boolean
}

/**
 * Talk to the workspace agent (D-028, D-039). It reads tasks, members and
 * documents as the person asking, and can only propose a task: an Admin
 * approves or rejects proposals on the Tasks page.
 */
export function AssistantPage() {
  const { active } = useWorkspace()
  // A conversation belongs to one workspace; switching workspace starts a fresh one.
  return <Conversation key={active?.id} />
}

function Conversation() {
  const { active } = useWorkspace()
  const chat = useAgentChat()
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const nextId = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, chat.isPending])

  function send(text: string) {
    const message = text.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!message || chat.isPending) return
    const history: ChatTurn[] = messages
      .filter((m) => !m.failed)
      .map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', content: message }])
    setDraft('')
    chat.mutate(
      { message, history },
      {
        onSuccess: (response) =>
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: 'assistant', content: response.reply, response },
          ]),
        onError: (err) =>
          setMessages((prev) => [
            ...prev,
            { id: nextId.current++, role: 'assistant', content: errorText(err, 'The assistant is unavailable.'), failed: true },
          ]),
      },
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    send(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Assistant"
        description={`Ask about your work in ${active?.name ?? 'this workspace'}, or ask for a task. Tasks it suggests wait for an Admin to approve them.`}
      />

      {messages.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-(--radius-panel) border border-dashed border-rule-strong bg-surface/60 px-6 py-8">
          <span className="grid size-11 place-items-center rounded-[10px] bg-sunken text-ink-2">
            <Robot aria-hidden size={22} weight="duotone" />
          </span>
          <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
            It can list your tasks and what's overdue, open a task with its subtasks, find people to assign, search the
            workspace documents, and propose new tasks. It sees only what you can see.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-10 cursor-pointer rounded-full border border-rule-strong bg-surface px-3.5 text-sm text-ink transition-colors hover:border-ink-3 hover:bg-paper"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol aria-label="Conversation" className="flex flex-col gap-4">
          {messages.map((m) => (
            <li key={m.id}>{m.role === 'user' ? <UserBubble text={m.content} /> : <AssistantMessage message={m} />}</li>
          ))}
          {chat.isPending && (
            <li role="status" className="flex items-center gap-2 text-sm text-ink-3">
              <CircleNotch aria-hidden size={15} weight="bold" className="animate-spin text-cobalt" />
              Working on it…
            </li>
          )}
        </ol>
      )}
      <div ref={endRef} />

      <form onSubmit={submit} className="sticky bottom-3 flex flex-col gap-2 rounded-(--radius-panel) border border-rule bg-surface p-3 shadow-(--shadow-panel)">
        <label htmlFor="agent-message" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="agent-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={chat.isPending}
          placeholder="What do I have to do this week? · Create a task for Sam to update the runbook by Friday"
          className="w-full resize-none bg-transparent px-1 text-[15px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-3">
            Replies aren't groundedness-checked. For a checked answer from documents, use{' '}
            <Link to="/ask" className="text-cobalt hover:underline">
              Ask
            </Link>
            .
          </p>
          <Button type="submit" disabled={!draft.trim()} loading={chat.isPending} leading={<PaperPlaneTilt aria-hidden size={16} weight="bold" />}>
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-(--radius-panel) bg-ink px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-on-ink sm:max-w-[70%]">
      {text}
    </div>
  )
}

function AssistantMessage({ message }: { message: Message }) {
  const response = message.response
  if (message.failed) {
    return (
      <div role="alert" className="flex max-w-[85%] gap-2 rounded-(--radius-panel) border border-danger/30 bg-danger-wash px-4 py-3 text-sm text-ink-2">
        <WarningCircle aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0 text-danger" />
        {message.content}
      </div>
    )
  }
  return (
    <div className="flex max-w-full flex-col gap-2.5 sm:max-w-[85%]">
      {response && response.steps.length > 0 && (
        <ul aria-label="What the assistant did" className="flex flex-wrap gap-1.5">
          {response.steps.map((step, i) => (
            <StepChip key={i} step={step} />
          ))}
        </ul>
      )}
      {response?.injection_detected && (
        <p className="flex gap-2 rounded-(--radius-control) border border-flag/30 bg-flag-wash px-3 py-2 text-[13px] text-ink-2">
          <ShieldWarning aria-hidden size={16} weight="fill" className="mt-0.5 shrink-0 text-flag" />
          A document it read contains text that looks like instructions. It was treated as content, and task proposals
          were switched off for this message.
        </p>
      )}
      <div className="rounded-(--radius-panel) border border-rule bg-surface px-4 py-3">
        <AnswerText
          text={message.content.replace(/\*\*(.+?)\*\*/g, '$1')}
          citations={response?.citations}
          className="text-[15px] leading-[1.7] text-ink"
        />
      </div>
      {response?.proposals.map((p) => <ProposalCard key={p.id} proposal={p} />)}
    </div>
  )
}

const TOOL_LABEL: Record<string, (args: Record<string, unknown>) => { icon: Icon; text: string }> = {
  list_tasks: (a) => ({
    icon: CheckCircle,
    text: a.scope === 'mine' ? 'Looked up your tasks' : a.scope === 'unassigned' ? 'Looked up unassigned tasks' : 'Looked up workspace tasks',
  }),
  get_task: () => ({ icon: CheckCircle, text: 'Opened a task' }),
  list_members: () => ({ icon: UsersThree, text: 'Checked members' }),
  search_workspace: (a) => ({ icon: MagnifyingGlass, text: `Searched documents for “${String(a.query ?? '')}”` }),
  propose_task: () => ({ icon: Robot, text: 'Proposed a task' }),
}

function StepChip({ step }: { step: AgentStep }) {
  const label = TOOL_LABEL[step.tool]?.(step.arguments) ?? { icon: Robot, text: step.tool }
  const IconGlyph = label.icon
  return (
    <li
      title={step.summary}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${
        step.ok ? 'bg-sunken text-ink-2' : 'bg-flag-wash text-flag'
      }`}
    >
      <IconGlyph aria-hidden size={12} weight="bold" />
      {label.text}
      {!step.ok && ' · not done'}
    </li>
  )
}

function ProposalCard({ proposal }: { proposal: AgentProposal }) {
  return (
    <div className="rounded-(--radius-panel) border border-cobalt/25 bg-cobalt-wash/50 px-4 py-3">
      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-cobalt">
        <Clock aria-hidden size={13} weight="bold" />
        Proposed · waiting for an Admin to approve
      </p>
      <p className="mt-1.5 flex items-center gap-2 font-medium text-ink">
        {proposal.priority && proposal.priority !== 'none' && <PriorityIcon priority={proposal.priority} />}
        {proposal.title}
      </p>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {[proposal.due_date ? `due ${formatDue(proposal.due_date)}` : null, proposal.assignee_email ? `for ${proposal.assignee_email}` : 'unassigned']
          .filter(Boolean)
          .join(' · ')}
      </p>
      <Link to="/tasks" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-cobalt hover:underline">
        Open Tasks
        <ArrowRight aria-hidden size={13} weight="bold" />
      </Link>
    </div>
  )
}
