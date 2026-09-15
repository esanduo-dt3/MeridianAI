/*
  Workspace surfaces for the PRD's MUST scope. Each one is an honest empty
  state: no sample rows, no placeholder metrics, no simulated answers. They are
  replaced by real features as the backend for each lands.
*/
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChatTeardropText,
  Files,
  ListMagnifyingGlass,
  NotePencil,
  Pulse,
  Tray,
} from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ReliabilityNote } from '../components/ReliabilityNote'
import { AdminOnly } from '../workspace/AdminOnly'

function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>
}

const linkAction =
  'inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-rule-strong bg-surface px-4 text-[15px] font-medium text-ink transition-colors hover:border-ink-3 hover:bg-paper'

export function AskPage() {
  return (
    <Page>
      <PageHeader
        title="Ask"
        status="not-built"
        description="Ask a question about this workspace. Every answer links to the passages it used."
      />
      <EmptyState
        icon={ChatTeardropText}
        title="Nothing to answer from yet"
        action={
          <Link to="/documents" className={linkAction}>
            Go to documents
            <ArrowRight aria-hidden size={16} weight="bold" />
          </Link>
        }
      >
        Meridian only answers from documents and notes in this workspace. Once a document is uploaded and processed, you
        can ask about it here.
      </EmptyState>
      <ReliabilityNote />
    </Page>
  )
}

export function NotesPage() {
  return (
    <Page>
      <PageHeader
        title="Notes"
        status="not-built"
        description="Write in blocks. The agent can suggest tasks from a note, but it never edits the note itself."
      />
      <EmptyState icon={NotePencil} title="No notes yet">
        Notes you create will be listed here, newest first.
      </EmptyState>
    </Page>
  )
}

export function DocumentsPage() {
  return (
    <Page>
      <PageHeader
        title="Documents"
        status="not-built"
        description="PDF and Word files, split into passages the agent can cite down to the character."
      />
      <EmptyState icon={Files} title="No documents yet">
        Uploaded files appear here with their processing status, so you can see when a document is ready to ask about.
      </EmptyState>
    </Page>
  )
}

export function ReviewQueuePage() {
  return (
    <Page>
      <PageHeader
        title="Review queue"
        status="not-built"
        description="Low-confidence answers, failed groundedness checks and pending agent actions that need a person."
      />
      <AdminOnly>
      <EmptyState icon={Tray} title="Nothing waiting for review">
        Flagged answers and actions will collect here. You can confirm, correct or dismiss each one, and every decision
        is recorded in the audit log.
      </EmptyState>
      </AdminOnly>
    </Page>
  )
}

export function AuditLogPage() {
  return (
    <Page>
      <PageHeader
        title="Audit log"
        status="not-built"
        description="Every answer, proposed action and review decision, with the time and who or what made it."
      />
      <AdminOnly>
      <EmptyState icon={ListMagnifyingGlass} title="No activity recorded">
        Entries are written by people, the agent and the system, and each one says which.
      </EmptyState>
      </AdminOnly>
    </Page>
  )
}

export function PipelineHealthPage() {
  return (
    <Page>
      <PageHeader
        title="Pipeline health"
        status="not-built"
        description="Retrieval hit rate, groundedness pass rate and latency, calculated from recorded retrieval runs."
      />
      <AdminOnly>
      <EmptyState icon={Pulse} title="No retrieval runs yet">
        Figures appear after the first question is answered. Every number on this page comes from a recorded run, and
        none are estimated.
      </EmptyState>
      </AdminOnly>
    </Page>
  )
}
