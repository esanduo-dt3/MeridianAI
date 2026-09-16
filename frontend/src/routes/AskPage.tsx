import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChatTeardropText, CircleNotch, PaperPlaneTilt } from '@phosphor-icons/react'
import { AnswerPanel } from '../agent/AnswerPanel'
import { RecentAnswers } from '../agent/RecentAnswers'
import { useAsk } from '../agent/useAsk'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { ErrorState, Skeleton } from '../components/Feedback'
import { SelectField } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { ReliabilityNote } from '../components/ReliabilityNote'
import { useDocuments } from '../documents/useDocuments'
import { errorText } from '../lib/queryClient'
import type { RetrievalProfile } from '../lib/types'
import { useWorkspace } from '../workspace/WorkspaceProvider'

const MAX_QUESTION_CHARS = 2000
const MIN_QUESTION_CHARS = 3

/** Matches the retrieval profiles in backend/app/rag/profiles.py. */
const PROFILES: Array<{ value: RetrievalProfile; label: string }> = [
  { value: 'lookup', label: 'Lookup — one specific fact, 5 passages' },
  { value: 'explore', label: 'Explore — a broader question, 8 passages' },
  { value: 'summarize', label: 'Summarize — wide coverage, 12 passages' },
]

/**
 * Ask a grounded question about this workspace. The answer, its citations, its
 * uncalibrated confidence and its groundedness result all come from one
 * POST /agent/ask; nothing on this page is computed in the browser.
 */
export function AskPage() {
  const { active } = useWorkspace()
  const docs = useDocuments()
  const ask = useAsk()
  const [question, setQuestion] = useState('')
  const [profile, setProfile] = useState<RetrievalProfile>('lookup')

  const ready = docs.data?.filter((d) => d.parsed_status === 'ready') ?? []
  const processing = docs.data?.filter((d) => d.parsed_status === 'pending' || d.parsed_status === 'processing') ?? []
  const trimmed = question.trim()
  const canAsk = trimmed.length >= MIN_QUESTION_CHARS && !ask.isPending

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canAsk) return
    ask.mutate({ question: trimmed, profile })
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter asks; Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canAsk) ask.mutate({ question: trimmed, profile })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ask"
        description={`Ask a question about ${active?.name ?? 'this workspace'}. Every answer links to the passages it used, and says how sure it is.`}
      />

      {docs.isPending ? (
        <Skeleton className="h-40 w-full rounded-(--radius-panel)" />
      ) : ready.length === 0 ? (
        <EmptyState
          icon={ChatTeardropText}
          title={processing.length > 0 ? 'Still processing the first document' : 'Nothing to answer from yet'}
          action={
            <Link
              to="/documents"
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-rule-strong bg-surface px-4 text-[15px] font-medium text-ink transition-colors hover:border-ink-3 hover:bg-paper"
            >
              Go to documents
              <ArrowRight aria-hidden size={16} weight="bold" />
            </Link>
          }
        >
          {processing.length > 0
            ? 'A document is being read and embedded. It becomes searchable when every passage is embedded, and then you can ask about it here.'
            : 'Meridian only answers from documents in this workspace. Once a document is uploaded and shows Ready, you can ask about it here.'}
        </EmptyState>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={MAX_QUESTION_CHARS}
            disabled={ask.isPending}
            placeholder={`What do you want to know about ${ready.length === 1 ? ready[0].file_name : `these ${ready.length} documents`}?`}
            className="w-full resize-y rounded-(--radius-panel) border border-rule-strong bg-surface px-4 py-3.5 text-[16px] leading-relaxed text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-3 hover:border-ink-3 focus:border-cobalt focus:shadow-[0_0_0_3px_var(--color-cobalt-wash)] focus:outline-none disabled:opacity-60"
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SelectField
              label="How to search"
              value={profile}
              onChange={(e) => setProfile(e.target.value as RetrievalProfile)}
              disabled={ask.isPending}
              wrapperClassName="min-w-[16rem] flex-1"
            >
              {PROFILES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </SelectField>
            <Button
              type="submit"
              disabled={!canAsk}
              loading={ask.isPending}
              leading={<PaperPlaneTilt aria-hidden size={16} weight="bold" />}
            >
              {ask.isPending ? 'Asking' : 'Ask'}
            </Button>
          </div>
          <ReliabilityNote />
        </form>
      )}

      {ask.isPending && <AskingNote />}

      {ask.isError && (
        <ErrorState
          title="That question wasn't answered"
          message={errorText(ask.error, "The question couldn't be answered. Try again.")}
          onRetry={() => ask.mutate({ question: trimmed, profile })}
        />
      )}

      {ask.isSuccess && !ask.isPending && <AnswerPanel result={ask.data} />}

      <section aria-labelledby="recent-answers" className="flex flex-col gap-3 border-t border-rule pt-8">
        <h2 id="recent-answers" className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
          Your recent answers
        </h2>
        <RecentAnswers />
      </section>
    </div>
  )
}

/*
  Answering searches, reranks, may rewrite and retry, then checks groundedness.
  On the free Gemini tier a model can be cooling down (D-032), so say so rather
  than leaving a spinner unexplained.
*/
function AskingNote() {
  return (
    <p
      role="status"
      className="flex gap-2.5 rounded-(--radius-panel) border border-rule bg-surface px-4 py-3.5 text-sm text-ink-2"
    >
      <CircleNotch aria-hidden size={16} weight="bold" className="mt-0.5 shrink-0 animate-spin text-cobalt" />
      <span>
        Searching the workspace, reranking the passages, writing the answer and checking it against the passages it
        cited. This can take a few seconds.
      </span>
    </p>
  )
}
