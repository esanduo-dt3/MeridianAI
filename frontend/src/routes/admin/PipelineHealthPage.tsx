import { useState } from 'react'
import { CheckCircle, Pulse, WarningCircle } from '@phosphor-icons/react'
import { usePipelineHealth } from '../../admin/useAdmin'
import { flagReasonText } from '../../agent/answerModel'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, Skeleton } from '../../components/Feedback'
import { SelectField } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { errorText } from '../../lib/queryClient'
import type { HealthRate, PipelineHealth } from '../../lib/types'
import { AdminOnly } from '../../workspace/AdminOnly'

/**
 * Figures calculated from recorded retrieval runs and answers, none estimated
 * (PRD 8.2, D-040). Every rate shows the counts behind it.
 */
export function PipelineHealthPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Pipeline health"
        description="Retrieval, groundedness and latency, calculated from every recorded question. Nothing on this page is estimated."
      />
      <AdminOnly>
        <Health />
      </AdminOnly>
    </div>
  )
}

function Health() {
  const [days, setDays] = useState(30)
  const health = usePipelineHealth(days)

  return (
    <div className="flex flex-col gap-6">
      <SelectField label="Period" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} wrapperClassName="w-48">
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
      </SelectField>

      {health.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading pipeline health">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-(--radius-panel)" />
          ))}
        </div>
      ) : health.isError ? (
        <ErrorState title="Pipeline health couldn't be loaded" message={errorText(health.error)} onRetry={() => void health.refetch()} />
      ) : health.data.questions === 0 ? (
        <EmptyState icon={Pulse} title="No questions in this period">
          Figures appear after questions are asked. Every number here comes from a recorded run.
        </EmptyState>
      ) : (
        <Dashboard h={health.data} />
      )}
    </div>
  )
}

const pct = (r: HealthRate) => (r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`)
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`)

function Dashboard({ h }: { h: PipelineHealth }) {
  const p50 = h.latency_ms.p50
  const latencyOk = p50 !== null && p50 < h.latency_ms.target_p50
  const peak = Math.max(1, ...h.by_day.map((d) => d.questions))

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Questions answered" value={String(h.questions)} detail={`${h.window.from} to ${h.window.to}`} />
        <Tile
          label="Retrieval graded good"
          value={pct(h.retrieval_graded_good)}
          detail={`${h.retrieval_graded_good.hits} of ${h.retrieval_graded_good.n} runs`}
          help="The pipeline's own grade on each run (reranker score, or the grading model). Not a measured hit rate: that comes from the golden set."
        />
        <Tile label="Groundedness passed" value={pct(h.groundedness_passed)} detail={`${h.groundedness_passed.hits} of ${h.groundedness_passed.n} answers`} />
        <Tile label="Flagged for review" value={pct(h.flagged)} detail={`${h.flagged.hits} of ${h.flagged.n} answers`} />
        <Tile
          label="Latency p50"
          value={secs(p50)}
          detail={`p95 ${secs(h.latency_ms.p95)} · target under ${secs(h.latency_ms.target_p50)}`}
          status={p50 === null ? undefined : latencyOk ? 'good' : 'bad'}
        />
        <Tile label="Retried retrieval" value={pct(h.retried)} detail={`${h.retried.hits} of ${h.retried.n} runs rewrote the query`} />
        <Tile
          label="Rerank unavailable"
          value={pct(h.rerank_unavailable)}
          detail={`${h.rerank_unavailable.hits} of ${h.rerank_unavailable.n} runs fell back to fusion order`}
          status={h.rerank_unavailable.hits > 0 ? 'bad' : 'good'}
          help="The reranker was down or rate-limited, so results were not reranked and the answer has no confidence value (D-037)."
        />
        <Tile label="Answers stored" value={String(h.answers)} detail="with citations, confidence and groundedness" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Breakdown title="Why answers were flagged" rows={Object.entries(h.flag_reasons).map(([k, v]) => [flagReasonText(k), v])} empty="Nothing was flagged." />
        <Breakdown title="Model that answered" rows={Object.entries(h.models)} empty="No answers." />
        <Breakdown title="Retrieval profile" rows={Object.entries(h.profiles)} empty="No runs." />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">By day</h2>
        <div className="overflow-x-auto rounded-(--radius-panel) border border-rule bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Pipeline figures per day</caption>
            <thead className="border-b border-rule text-left text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Date</th>
                <th scope="col" className="px-4 py-2 font-medium">Questions</th>
                <th scope="col" className="px-4 py-2 font-medium">Graded good</th>
                <th scope="col" className="px-4 py-2 font-medium">Grounded</th>
                <th scope="col" className="px-4 py-2 font-medium">Flagged</th>
                <th scope="col" className="px-4 py-2 font-medium">Latency p50</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {[...h.by_day].reverse().filter((d) => d.questions > 0).map((d) => (
                <tr key={d.date}>
                  <td className="px-4 py-2 font-mono text-xs text-ink-2 tabular">{d.date}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-6 text-right text-ink tabular">{d.questions}</span>
                      <span
                        title={`${d.questions} question${d.questions === 1 ? '' : 's'} on ${d.date}`}
                        className="h-2 rounded-r-[4px] bg-cobalt"
                        style={{ width: `${Math.max(4, (d.questions / peak) * 120)}px` }}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink tabular">{pct(d.graded_good)} <span className="text-xs text-ink-3">({d.graded_good.hits}/{d.graded_good.n})</span></td>
                  <td className="px-4 py-2 text-ink tabular">{pct(d.groundedness_passed)} <span className="text-xs text-ink-3">({d.groundedness_passed.hits}/{d.groundedness_passed.n})</span></td>
                  <td className="px-4 py-2 text-ink tabular">{d.flagged.hits}</td>
                  <td className="px-4 py-2 text-ink tabular">{secs(d.latency_p50_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3">Days with no questions are omitted.</p>
      </section>
    </>
  )
}

function Tile({ label, value, detail, help, status }: { label: string; value: string; detail: string; help?: string; status?: 'good' | 'bad' }) {
  return (
    <div className="flex flex-col gap-1 rounded-(--radius-panel) border border-rule bg-surface p-4" title={help}>
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink tabular">{value}</span>
      <span className="text-xs text-ink-3">{detail}</span>
      {status && (
        <span className={`mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium ${status === 'good' ? 'text-grounded' : 'text-flag'}`}>
          {status === 'good' ? <CheckCircle aria-hidden size={13} weight="fill" /> : <WarningCircle aria-hidden size={13} weight="fill" />}
          {status === 'good' ? 'Within target' : 'Needs attention'}
        </span>
      )}
    </div>
  )
}

function Breakdown({ title, rows, empty }: { title: string; rows: Array<[string, number]>; empty: string }) {
  return (
    <div className="rounded-(--radius-panel) border border-rule bg-surface p-4">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {rows.map(([name, count]) => (
            <li key={name} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 text-ink-2">{name}</span>
              <span className="text-ink tabular">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
