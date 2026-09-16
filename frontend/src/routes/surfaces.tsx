/*
  The admin surfaces that are still to be built. Each one is an honest empty
  state: no sample rows, no placeholder metrics, no simulated answers. They are
  replaced by real features as the backend for each lands.
*/
import type { ReactNode } from 'react'
import { ListMagnifyingGlass, Pulse, Tray } from '@phosphor-icons/react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { AdminOnly } from '../workspace/AdminOnly'

function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-8">{children}</div>
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
