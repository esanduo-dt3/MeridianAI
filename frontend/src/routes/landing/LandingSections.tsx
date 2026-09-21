import {
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  FileMagnifyingGlass,
  ListChecks,
  Notebook,
  Pulse,
  Robot,
  SealCheck,
  ShieldCheck,
  Tray,
  UploadSimple,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react'
import { FlowDiagram } from './FlowDiagram'

/*
  Landing content for the public (signed-out) page.

  Every claim below describes behaviour that exists in this repository:
  document ingestion (`rag/ingest.py`, DocumentsPage), grounded answers with
  citations (`rag/answer.py`, AnswerPanel/AnswerText), uncalibrated confidence
  and review routing (ConfidenceLabel, ReliabilityNote, /admin/review), notes
  (NotesPage), tasks with agent proposals (TasksPage), workspace membership and
  roles (MembersPage), and the audit log (/admin/audit). No invented metrics,
  customer logos or unbuilt features belong here.
*/

interface Step {
  icon: Icon
  step: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: UploadSimple,
    step: '01',
    title: 'Bring in your documents',
    body: 'Upload the PDFs and Word files your team already works from. Meridian parses them, splits them into passages and indexes them inside your workspace only.',
  },
  {
    icon: ChatCircleText,
    step: '02',
    title: 'Ask in plain language',
    body: 'Ask the assistant a question the way you would ask a colleague. Meridian retrieves the relevant passages across your documents and drafts an answer from them.',
  },
  {
    icon: FileMagnifyingGlass,
    step: '03',
    title: 'Check the source, then act',
    body: 'Each answer links to the exact passage it used, with its confidence shown. Open the source, confirm it, then turn the outcome into a note or a task.',
  },
]

interface Capability {
  icon: Icon
  title: string
  body: string
}

const CAPABILITIES: Capability[] = [
  {
    icon: SealCheck,
    title: 'Citations on every answer',
    body: 'Answers point at the passage behind them, so nothing has to be taken on trust. Open the document and read the original in place.',
  },
  {
    icon: Pulse,
    title: 'Honest confidence',
    body: 'Every answer carries a confidence value, clearly labelled uncalibrated. It is a signal to check further, never presented as a probability.',
  },
  {
    icon: Tray,
    title: 'Human review queue',
    body: 'Low-confidence or ungrounded answers are routed to a reviewer instead of being handed over as fact.',
  },
  {
    icon: Robot,
    title: 'The agent proposes, you decide',
    body: 'When the assistant suggests tasks, they wait in a proposal list. Nothing enters your workspace until an Admin approves it.',
  },
  {
    icon: Notebook,
    title: 'Notes and tasks in one place',
    body: 'Capture what you learned in a rich note, or convert it into a tracked task, without leaving the workspace the answer came from.',
  },
  {
    icon: ShieldCheck,
    title: 'Scoped access and an audit trail',
    body: 'Documents, notes and tasks are visible only to members you add. Roles control what each person can do, and actions are recorded in the audit log.',
  },
]

interface UseCase {
  icon: Icon
  audience: string
  body: string
}

const USE_CASES: UseCase[] = [
  {
    icon: UsersThree,
    audience: 'Teams answering the same question twice',
    body: 'Runbooks, field guides and policies stop being a folder nobody opens. Ask once and get the answer with its source attached.',
  },
  {
    icon: ListChecks,
    audience: 'Operators who must be able to prove it',
    body: 'When an answer drives a decision, the cited passage and the audit entry are both there afterwards.',
  },
  {
    icon: Notebook,
    audience: 'New joiners finding their footing',
    body: 'Instead of reading everything, ask what applies right now and follow the citation into the document that governs it.',
  },
]

/** Section heading used across the landing page so rhythm stays consistent. */
function SectionHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="max-w-[46rem]">
      <p className="font-mono text-[11px] tracking-[0.16em] text-ink-3 uppercase">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[28px] leading-tight font-semibold tracking-[-0.035em] text-ink sm:text-[34px]">
        {title}
      </h2>
      {lede && <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{lede}</p>}
    </div>
  )
}

// PUBLIC_INTERFACE
export function HowItWorksSection() {
  /** Three-step explanation of the product loop: ingest, ask, verify and act. */
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-24 border-t border-rule py-16 sm:py-20">
      <div id="how-it-works-title">
        <SectionHeading
          eyebrow="How it works"
          title="From a folder of documents to an answer you can defend"
          lede="Meridian is a workspace assistant for teams whose documents actually matter. It reads what you give it, answers from that, and shows the evidence."
        />
      </div>

      {/* Animated walkthrough of the pipeline; the written steps below repeat it in prose. */}
      <div className="mt-10">
        <FlowDiagram />
      </div>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map(({ icon: StepIcon, step, title, body }) => (
          <li
            key={step}
            className="rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-hairline)"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-cobalt-wash text-cobalt"
              >
                <StepIcon size={20} weight="bold" />
              </span>
              <span className="font-mono text-[11px] tracking-[0.16em] text-ink-3 uppercase">Step {step}</span>
            </div>
            <h3 className="mt-5 font-display text-[18px] leading-snug font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

// PUBLIC_INTERFACE
export function CapabilitiesSection() {
  /** Grid of the capabilities that distinguish Meridian from a generic chatbot. */
  return (
    <section id="capabilities" aria-labelledby="capabilities-title" className="scroll-mt-24 border-t border-rule py-16 sm:py-20">
      <div id="capabilities-title">
        <SectionHeading
          eyebrow="What you get"
          title="Built so you never have to guess where an answer came from"
          lede="A general chatbot is confident everywhere. Meridian is useful precisely because it tells you where it is not."
        />
      </div>

      <ul className="mt-10 grid gap-px overflow-hidden rounded-(--radius-panel) border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map(({ icon: ItemIcon, title, body }) => (
          <li key={title} className="bg-surface p-6">
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-(--radius-control) border border-rule bg-paper text-cobalt"
            >
              <ItemIcon size={20} weight="bold" />
            </span>
            <h3 className="mt-4 font-display text-[17px] leading-snug font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// PUBLIC_INTERFACE
export function UseCasesSection() {
  /** Who the product helps, framed as concrete situations rather than personas. */
  return (
    <section id="use-cases" aria-labelledby="use-cases-title" className="scroll-mt-24 border-t border-rule py-16 sm:py-20">
      <div id="use-cases-title">
        <SectionHeading
          eyebrow="Who it helps"
          title="For work where a wrong answer costs something"
          lede="Meridian fits teams that already have the knowledge written down and need to reach it quickly without losing the paper trail."
        />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {USE_CASES.map(({ icon: CaseIcon, audience, body }) => (
          <article
            key={audience}
            className="flex flex-col rounded-(--radius-panel) border border-[var(--glass-edge)] bg-[var(--glass-surface)] p-6 backdrop-blur-[var(--glass-blur)]"
          >
            <span aria-hidden className="text-cobalt">
              <CaseIcon size={22} weight="bold" />
            </span>
            <h3 className="mt-4 font-display text-[17px] leading-snug font-semibold tracking-[-0.02em] text-ink">
              {audience}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

// PUBLIC_INTERFACE
export function TrustSection() {
  /** States the product's limits plainly; trust is the core positioning. */
  const limits = [
    'Answers are drawn from your documents, not from the open web.',
    'Confidence values are uncalibrated and are shown as such.',
    'Weak or ungrounded answers are sent to a person for review.',
    'Agent-suggested tasks require an Admin approval before they exist.',
  ]

  return (
    <section id="trust" aria-labelledby="trust-title" className="scroll-mt-24 border-t border-rule py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div id="trust-title">
          <SectionHeading
            eyebrow="Straight about limits"
            title="An assistant that tells you when to double-check it"
            lede="AI answers can be incomplete or wrong. Meridian is designed around that fact instead of hiding it, which is what makes it safe to use on real work."
          />
        </div>

        <ul className="flex flex-col gap-3 rounded-(--radius-panel) border border-rule bg-surface p-6 shadow-(--shadow-panel)">
          {limits.map((limit) => (
            <li key={limit} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
              <CheckCircle aria-hidden size={18} weight="bold" className="mt-0.5 shrink-0 text-grounded" />
              {limit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// PUBLIC_INTERFACE
export function ClosingCta({ onSignIn, disabled }: { onSignIn: () => void; disabled?: boolean }) {
  /**
   * Final call to action.
   *
   * @param onSignIn - Starts the same Google sign-in flow as the hero button.
   * @param disabled - True when sign-in is not configured for this deployment.
   */
  return (
    <section aria-labelledby="closing-cta-title" className="border-t border-rule py-16 sm:py-20">
      <div className="rounded-(--radius-panel) border border-rule bg-ink px-7 py-10 text-on-ink sm:px-10 sm:py-12">
        <h2
          id="closing-cta-title"
          className="max-w-[24ch] font-display text-[26px] leading-tight font-semibold tracking-[-0.035em] sm:text-[32px]"
        >
          Put your team's documents to work.
        </h2>
        <p className="mt-3 max-w-[54ch] text-[16px] leading-relaxed opacity-80">
          Sign in with Google, create a workspace, and upload your first document. You will be asking questions against it
          in a few minutes.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          disabled={disabled}
          className="mt-7 inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-(--radius-control) bg-on-ink px-5 text-[15px] font-medium text-ink transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Get started free
          <ArrowRight aria-hidden size={18} weight="bold" />
        </button>
      </div>
    </section>
  )
}

// PUBLIC_INTERFACE
export function LandingFooter() {
  /** Minimal footer carrying the standing reliability disclaimer. */
  return (
    <footer className="border-t border-rule py-8">
      <p className="max-w-[72ch] text-xs leading-relaxed text-ink-3">
        AI answers can be incomplete or wrong. Confidence values are uncalibrated, and low-confidence answers go to a
        person for review. Always read the cited passage before acting on an answer.
      </p>
      <p className="mt-3 text-xs text-ink-3">© {new Date().getFullYear()} Meridian</p>
    </footer>
  )
}
