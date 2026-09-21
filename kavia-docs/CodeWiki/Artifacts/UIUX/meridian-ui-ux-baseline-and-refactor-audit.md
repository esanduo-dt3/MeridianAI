[CodeWiki](../../index.md) / [Artifacts](../index.md) / [UI/UX](index.md)

# Meridian UI/UX Baseline and Refactor Audit

## Purpose and Scope

This audit establishes the current UI/UX baseline for the approved MeridianAI interface enhancement. It compares the implemented frontend and documented design system with the three supplied professional workspace references. It then identifies focused refactor opportunities without proposing changes to MeridianAI's product rules, authorization model, or trust guarantees.

The assessment covers authentication and onboarding, the persistent application shell, tasks, the assistant, notes, documents, document inspection, members, review operations, audit history, and pipeline health. Shared controls, dialogs, feedback states, responsive behavior, accessibility, and motion are also included.

This is a source-level audit rather than a live usability test. No running application container or authenticated test session was available during the assessment. Current-state behavior is therefore verified from implementation code and repository documentation, while observations about the supplied images are based on direct visual inspection. Runtime rendering, real-data density, browser compatibility, and task completion times remain to be validated during the refactor.

## Status Note

This audit predates the completed refactor, so two of its structural observations are superseded. The desktop sidebar is now a 248-pixel grid column in `frontend/src/layouts/AppShell.tsx` rather than 256 pixels, and the universal `max-w-[1080px]` content cap described below no longer exists, because route canvas width is owned per route by `frontend/src/layouts/PageFrame.tsx` through its `reading`, `operational`, and `split` modes. For the current post-refactor baseline of the navigation rail, the Tasks chrome, the agent-proposal panel, and the first-run landing surface, see the [Meridian UI Redesign Baseline](meridian-ui-redesign-baseline-audit.md). The remaining product-identity, trust, accessibility, and motion analysis in this document still applies.

## Executive Baseline

MeridianAI already has a coherent and credible design foundation. Its graphite dark theme, mineral light theme, constrained accent palette, typography, focus treatment, accessible dialogs, explicit feedback, and reduced-motion support are materially stronger than a generic application scaffold. The interface also expresses the product's central trust proposition through inspectable citations, visible groundedness, labelled confidence, human review, and explicit approval of agent actions.

The principal limitation is not visual polish in isolation. The existing shell treats most routes as centered documents inside a fixed-width content column. That arrangement supports reading but gives operational screens less horizontal space, persistent context, and information density than the supplied references. Individual pages solve this independently: Notes introduces a second sidebar, Tasks adds its own header and drawer, Documents uses list-to-page navigation, and administrative screens use cards or tables. This produces capable local workflows but an inconsistent application-wide workspace model.

The recommended direction is to preserve MeridianAI's restrained “precise instrument” identity while adopting the references' stronger workspace composition. Desktop operational routes should support persistent navigation, a fluid work surface, and an optional contextual inspector. Reading-focused routes should retain constrained line lengths. The goal is not to copy the references' brand or feature taxonomy; it is to adopt their clarity of hierarchy, density, and continuity.

## Audit Scorecard

| Dimension | Current baseline | Assessment |
| --- | --- | --- |
| Product identity | Strong | The cobalt meridian line, citation-only highlight color, restrained typography, and trust signals give MeridianAI a distinct product voice. |
| Visual consistency | Good | Tokens and shared controls are coherent, but route-level headers, page frames, filters, and information layouts vary. |
| Navigation clarity | Good | Primary destinations and role-specific administration are clear, although project context and secondary location are not persistent in the work surface. |
| Information density | Moderate | Task rows and audit entries can be compact, but large page headers, generous vertical gaps, and the global content cap reduce desktop working density. |
| Context continuity | Moderate | Tasks has a contextual drawer and Notes has a master-detail layout, but other list-to-detail flows replace the work surface. |
| Workflow feedback | Strong | Loading, error, empty, saving, ingestion, approval, and destructive-action states are explicitly represented. |
| Accessibility foundation | Strong | Skip navigation, focus transfer, labelled icon controls, semantic status, keyboard drag-and-drop, touch targets, and reduced motion are implemented. |
| Responsive behavior | Good | The sidebar becomes a drawer and most forms reflow; the task board and health table intentionally rely on local horizontal scrolling. |
| Motion quality | Good | Existing motion communicates navigation, entry, citation provenance, drawers, and drag state, although duration and reduced-motion handling need centralization. |
| Professional workspace fit | Moderate to good | The application is polished and trustworthy, but its frame and route compositions need greater density and contextual persistence to match the supplied references. |

## Evidence and Evaluation Method

The implementation trace started at `frontend/src/App.tsx`, continued through `AppShell`, and covered every route mounted in the authenticated shell. The investigation then followed the task workflow into its list, board, sprint, proposal, quick-add, and detail components. It also followed the document and assistant workflows through citation display, document passage inspection, answer signals, and administrative review.

The supplied references depict three views of a dark project-management workspace. One uses a central issue list with a right-side detail inspector. Another uses a hierarchy-oriented work list with status, priority, and assignee signals aligned into compact rows. The third presents a roadmap or project surface with persistent navigation, compact top-level filters, and grouped work items. Across all three, navigation remains stable while users switch work context.

The references are treated as layout and interaction evidence only. Their names, icons, feature set, brand treatment, and exact colors are not requirements for MeridianAI.

## Verified Current-State Foundation

### Application Architecture and Route Coverage

The authenticated application is organized around one persistent shell. `frontend/src/App.tsx` places Tasks, Assistant, Notes, Documents, Members, and three administrative destinations beneath `AppShell`.

```tsx
<Route element={<AppShell />}>
  <Route index element={<Navigate to="/tasks" replace />} />
  <Route path="assistant" element={<AssistantPage />} />
  <Route path="notes" element={<NotesPage />} />
  <Route path="documents" element={<DocumentsPage />} />
  <Route path="tasks" element={<TasksPage />} />
  <Route path="members" element={<MembersPage />} />
  <Route path="admin/review" element={<ReviewQueuePage />} />
  <Route path="admin/audit" element={<AuditLogPage />} />
  <Route path="admin/health" element={<PipelineHealthPage />} />
</Route>
```

This central route hierarchy is a good refactor seam because application-wide framing can change without altering product routing or data behavior.

### Product-Specific Design Identity

The documented direction explicitly positions MeridianAI as a precise and inspectable tool rather than a generic chat product. The design system reserves cobalt for action and location and yellow exclusively for cited passages. The implementation follows this direction through global tokens in `frontend/src/index.css`.

```css
--color-paper: #f4f5f2;
--color-surface: #ffffff;
--color-ink: #111418;
--color-cobalt: #2743c9;
--color-mark: #ffe27a;
--radius-control: 8px;
--radius-panel: 12px;
```

Dark mode is not an afterthought. The same semantic tokens are redefined as graphite surfaces, lifted text colors, and accessible status colors.

```css
[data-theme='dark'] {
  --color-paper: #0d0f12;
  --color-surface: #15181c;
  --color-sunken: #1c2025;
  --color-ink: #eceef1;
  --color-cobalt: #8098ff;
  --color-mark: #5b4a0f;
}
```

This semantic token model should be retained. The supplied references also use restrained dark surfaces, but MeridianAI should continue to express its own cobalt meridian and citation highlight rather than adopting another product's palette.

### Navigation and Responsive Shell

`AppShell` provides a 256-pixel desktop sidebar and a mobile drawer below the large breakpoint. It separates ordinary workspace navigation from administrator-only tools, keeps the workspace switcher visible, and includes theme and account controls.

```tsx
<div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
  <aside className="sticky top-0 hidden h-dvh border-r border-rule bg-paper lg:block">
    <Sidebar layoutGroup="desktop" />
  </aside>
  <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">
    <motion.div
      className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12"
    >
      <Outlet />
    </motion.div>
  </main>
</div>
```

The shell also implements a skip link and moves focus to the main region after navigation. These behaviors must remain non-negotiable through any layout refactor.

The main structural constraint is the universal `max-w-[1080px]` centered frame. It is appropriate for sign-in copy, note editing, and answer reading, but it restricts boards, work lists, dashboards, and list-detail compositions that benefit from the full available viewport.

### Reusable Controls and Feedback

Shared components provide a meaningful consistency layer. `Button` supplies variants, pending feedback, disabled behavior, a 44-pixel minimum target, and a restrained press response.

```tsx
className={`inline-flex min-h-11 cursor-pointer items-center justify-center
  gap-2.5 rounded-(--radius-control) px-4 text-[15px] font-medium
  transition-[background-color,border-color,color,transform]
  active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50
  ${variants[variant]} ${className}`}
```

`Dialog` delegates focus trapping, Escape handling, and scroll locking to Radix while applying Meridian tokens. `Field` consistently associates labels, hints, errors, and `aria-describedby`. `Feedback` provides skeleton and recoverable error states, while `EmptyState` prevents blank screens from appearing unfinished.

This layer is an important strength. The refactor should extend it with workspace framing and compact toolbar primitives rather than replacing it.

### Motion and Reduced Motion

The shell uses a short page-entry transition and a spring-based active-navigation marker. The mobile drawer, task detail drawer, dialogs, citation specimen, ingestion indicators, and board drag overlay also communicate state through motion.

```tsx
<motion.div
  key={location.pathname}
  initial={reduce ? false : { opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
>
```

A global reduced-motion rule substantially shortens CSS animation and transition durations.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is a sound baseline. The remaining inconsistency is that programmatic `scrollIntoView({ behavior: 'smooth' })` is used in the assistant and document viewer without checking `useReducedMotion`. JavaScript-requested smooth scrolling should be aligned with the user's motion preference during the refactor.

## Workflow Baseline

### Tasks

Tasks is currently the closest MeridianAI surface to the visual references. It provides list and board views, search, completed-item filtering, sprint scope, agent-proposal approval, quick creation, keyboard shortcuts, hierarchical subtasks, drag-and-drop, and a contextual detail drawer.

The list view is compact and exposes status, hierarchy, progress, due date, priority, and assignee without opening the task.

```tsx
<div className="group flex min-h-11 items-center gap-1 rounded-(--radius-control)">
  <StatusCircle status={task.status} />
  <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left">
    <span className="truncate text-[15px]">{task.title}</span>
  </button>
  <Progress {...progress} />
  <DueDate task={task} compact />
  <PriorityIcon priority={task.priority} />
  <Assignee person={task.assignee} />
</div>
```

The board supports pointer and keyboard drag-and-drop, cross-column movement, screen-reader announcements, and a drag overlay. Its local `min-w-[760px]` preserves board usability but produces horizontal scrolling on narrower screens.

The task drawer is a successful example of context continuity. It keeps the task surface underneath while exposing status, priority, sprint, assignee, due date, description, subtasks, provenance, and timestamps in a right-side panel.

```tsx
<RadixDialog.Content
  className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px]
    flex-col border-l border-rule bg-surface shadow-(--shadow-lift)"
>
```

The main tasks-page limitation is the amount of control chrome placed before the work itself. The title, counters, view tabs, search, completion toggle, permission guidance, sprint tabs, and optional sprint controls occupy multiple rows. The supplied references compress comparable controls into a shallower application bar and leave more of the viewport for work items.

### Assistant and Inspectable Answers

The assistant is not a generic chat panel. It decides which workspace tool is needed, describes what it did, displays document answers with exact citations, identifies prompt-injection handling, and shows proposed tasks without executing them.

`AnswerPanel` presents the answer, linked citation markers, confidence, groundedness, review status, source passages, retrieval details, and the product reliability note. This is a strong implementation of the product's “trustworthy because inspectable” requirement.

The current presentation becomes vertically long when an answer contains several citations and retrieval details. A future desktop layout can improve inspection by placing source passages or answer metadata in an optional contextual panel while preserving the complete linear reading order on small screens.

### Notes

Notes already uses a master-detail structure within the shell. Its local list includes search, recent-update information, and selection state, while the editor provides block content, slash commands, formatting, auto-save, and visible save status.

```tsx
<div className="-my-8 flex min-h-[calc(100dvh-3.5rem)] flex-col lg:-my-12 lg:min-h-dvh lg:flex-row">
  <aside className="lg:w-72 lg:shrink-0 lg:border-r">
    ...
  </aside>
  <section className="min-w-0 flex-1">
    ...
  </section>
</div>
```

The negative margins are evidence that Notes needs a layout mode different from the shell's default centered page. This is functional, but formal page-frame variants would make the behavior intentional and reusable rather than route-specific.

The note body is correctly constrained to 720 pixels for reading quality. That constraint should remain on the editor canvas even if the surrounding work surface becomes fluid.

### Documents and Citation Inspection

The document list clearly exposes upload capability, file type, processing state, passage count, uploader, timestamp, retry behavior, and destructive actions. Ingestion feedback is unusually complete: pending, processing, embedding progress, ready, and failure states are all visible.

Opening a document replaces the list with a dedicated passage viewer. The viewer then introduces another master-detail composition consisting of passage navigation and extracted text. Citation links can select a chunk or exact character span, and the cited range is highlighted with the reserved mark color.

The workflow is inspectable but requires navigation away from the originating list or answer. On desktop, the same information architecture could be expressed through a contextual inspector or split view. On small screens, the existing full-page viewer remains appropriate.

### Members and Administration

Members exposes invitations, authorization roles, team roles, removal, pending invitations, and workspace departure. Review Queue preserves the human decision boundary for flagged answers and proposed actions. Audit Log provides attributable expandable entries and filters. Pipeline Health exposes real counts behind every metric and avoids estimated values.

These screens are trustworthy and explicit, but their compositions differ. Members uses cards and list rows, Review Queue uses stacked decision cards, Audit Log uses expandable rows, and Pipeline Health uses metric tiles, breakdown cards, and a table. Shared operational headers, filter bars, status treatments, and density modes would make these tools feel like one administrative workspace.

## Visual Reference Findings

### Persistent Context

All three references retain a narrow global navigation rail and a stable project-level context while the central work view changes. MeridianAI retains global workspace navigation, but project or section context is generally restated in page descriptions rather than represented in a compact persistent header.

The right-side issue inspector visible in the first reference is especially relevant to MeridianAI's Tasks and citation workflows. MeridianAI already has the necessary interaction pattern in `TaskDrawer`; the opportunity is to formalize it as a reusable contextual-inspector pattern rather than inventing a new panel system.

### Dense but Legible Work Surfaces

The references use compact row heights, shallow headers, aligned metadata, subdued separators, and selective accent color. MeridianAI's task rows and audit entries already demonstrate this density. The broader route frames, however, use larger title treatments and vertical spacing designed for editorial pages.

A professional enhancement should not reduce every target below MeridianAI's 44-pixel accessibility floor. Instead, it should improve density through alignment, column use, collapsible secondary copy, and better allocation of desktop width.

### Layered Navigation

The references distinguish global workspace navigation, project navigation, view selection, filters, and item inspection. MeridianAI currently has global navigation and route-specific filters but no standardized middle layer. Tasks, Notes, Documents, and administration each implement that layer differently.

A compact route header with breadcrumb or section context, title, view tabs, search, filters, and primary action would create a predictable hierarchy while avoiding an additional permanent navigation rail where it is not needed.

### Restrained Surfaces and Status Color

The references use subtle surface steps rather than pronounced card shadows. MeridianAI already follows this direction in dark mode and uses semantic colors for groundedness, flags, danger, and cobalt location. The existing palette therefore requires refinement rather than replacement.

The refactor should reduce unnecessary standalone card treatment on dense operational screens while retaining panels for semantically bounded content such as agent proposals, flagged answers, dialogs, and metrics.

## Refactor Findings and Priorities

### Priority 0: Introduce Explicit Page-Frame Modes

The universal centered frame is the highest-leverage structural issue. `AppShell` should support at least a reading frame and an operational frame. The reading frame should preserve a bounded width and generous whitespace for the assistant, note body, sign-in content, and long-form document text. The operational frame should use the available width for Tasks, Documents, Members, Review Queue, Audit Log, and Pipeline Health.

A third split-workspace mode should support a secondary list or contextual inspector. Notes already demonstrates the need, and Tasks already provides the inspector behavior.

This refactor belongs at `frontend/src/layouts/AppShell.tsx`, with route-level selection supplied through a small page-layout contract or nested layout components. It should remove the need for Notes to counteract shell padding with negative margins.

### Priority 0: Standardize the Operational Header

`PageHeader` currently supports a title, description, status, and action. Tasks implements a separate custom header because it also needs counts, view tabs, search, scope controls, and filters. This divergence should be resolved through a composable operational-header family rather than by forcing every route into the existing component.

The family should provide consistent locations for section context, title, concise supporting status, view tabs, filters, search, and a primary action. Long explanatory descriptions should remain available but collapse into help text or secondary content on dense routes.

The initial implementation seams are `frontend/src/components/PageHeader.tsx` and `frontend/src/routes/TasksPage.tsx`. Documents, Members, Review Queue, Audit Log, and Pipeline Health should migrate only after the primitive proves stable on Tasks.

### Priority 1: Formalize a Reusable Contextual Inspector

`TaskDrawer` proves that a right-side detail surface works with MeridianAI's visual language and accessibility stack. It should be decomposed into a reusable inspector shell with standard overlay, width, header, scroll region, close behavior, responsive full-screen mode, and motion.

The task-specific fields should remain inside `TaskDrawer`. The reusable shell can later support document metadata, citation passages, member details, or audit-entry inspection when those workflows benefit from context preservation.

The desktop inspector should not always obscure the work surface with a dark overlay. At sufficiently wide breakpoints, it can participate in a three-column grid or use a lighter scrim so users can retain list context. Mobile should retain a modal, full-width treatment.

### Priority 1: Harmonize Density and Metadata Alignment

Operational rows should share a common density scale, metadata alignment, hover treatment, selection treatment, and action-reveal behavior. `TaskListView`, `DocumentsPage`, `MembersPage`, and `AuditLogPage` currently implement these conventions independently.

The task row provides the strongest starting baseline because it already supports hierarchy and aligned metadata. The document and member lists should not become visually identical, but they should use the same spacing and interaction vocabulary.

Destructive controls should remain discoverable to keyboard and touch users. If lower-priority actions become visually hidden until hover, they must still appear on focus-within and remain available in an explicit overflow menu on touch layouts.

### Priority 1: Consolidate Filter and View Controls

Search fields, tabs, native selects, checkboxes, sprint tabs, and filter buttons currently use several local compositions. A shared toolbar should handle wrapping, horizontal overflow, responsive collapse, and compact labels.

The toolbar should preserve native controls where they offer the best accessibility and platform behavior. Visual refinement should not require replacing every native select with a custom menu. Custom controls are justified only where they materially improve searchable selection, multi-select filtering, or complex option presentation.

### Priority 2: Improve Cross-Workflow Context Continuity

Documents should retain list context when a user inspects metadata or passages on a wide viewport. The assistant should offer an optional citation inspector for source comparison without removing citations from the answer's semantic reading order. Audit details can use either the existing inline expansion or an inspector depending on data length.

These changes must remain route-preserving and deep-linkable. Existing URLs such as `/documents/:documentId` and query parameters for task or passage selection are valuable and should continue to represent open context.

### Priority 2: Tighten Motion Semantics

The current 350-millisecond page rise is calm but may feel slow when moving repeatedly between dense work views. Operational transitions should generally fall in the 120-to-220-millisecond range, while explanatory sign-in or citation-sequence motion can remain slower.

Motion tokens should be centralized for quick feedback, panel entry, overlay fades, and emphasized provenance sequences. Components that call `scrollIntoView` with smooth behavior must consult `useReducedMotion`. Loading spinners and progress indicators should remain because they communicate active system state rather than decoration.

### Priority 2: Unify Responsive Overflow Rules

The task board and pipeline table correctly isolate horizontal overflow, but their behavior should be documented and visually consistent. At narrow widths, the application itself must not develop horizontal overflow; only the bounded board or table region may scroll.

Operational toolbars should either wrap or become locally scrollable with visible overflow cues. Inspectors should become full-screen sheets. Master-detail routes should show one pane at a time with an explicit, focus-managed return action, following the existing Notes behavior.

## Target Experience Baseline

### Desktop Workspace Model

The preferred desktop structure is a stable navigation column, a fluid route work surface, and an optional contextual inspector. The main surface should not have one global maximum width. Each route should choose a readable, operational, or split layout according to its content.

The navigation column should preserve workspace switching, primary destinations, administrative separation, theme selection, reliability messaging, and account controls. It may become slightly narrower if labels and targets remain clear, but compactness must not reduce accessibility.

### Visual Hierarchy

Operational screens should use a shallower header and reserve large display typography for onboarding, empty first-run states, and reading-oriented content. Route identity, current scope, and primary action should remain visible without pushing work below the fold.

Surface distinction should rely first on spacing, separators, and graphite steps. Shadows should be limited to overlays, lifted drag state, dialogs, and inspector separation. Cobalt should continue to indicate current location, focus, links, and primary action. Yellow must remain exclusive to cited text.

### Interaction Model

Primary work items should open in contextual detail on wide screens and transition to full-screen detail on narrow screens. Search, view, filter, and scope state should remain URL-addressable where it changes what work is visible.

Keyboard support must remain first-class. The existing `/` search shortcut, `N` quick-add shortcut, keyboard board movement, Escape handling, focus transfer, and semantic announcements should be preserved and documented in discoverable tooltips or shortcut help.

### Motion Model

Motion should communicate origin, destination, hierarchy, or system progress. Navigation markers may slide, panels may enter from their attached edge, selected citations may reveal their passage, and drag overlays may lift. Decorative looping motion should not be introduced.

Every new animation must have a reduced-motion result that preserves state communication. Motion should never delay access to controls or conceal content needed to complete a task.

## File-Level Refactor Map

| Area | Primary files | Focused change |
| --- | --- | --- |
| Shell and page frames | `frontend/src/layouts/AppShell.tsx` | Add reading, operational, and split frame modes; remove the universal content-width constraint from operational routes. |
| Header system | `frontend/src/components/PageHeader.tsx`, `frontend/src/routes/TasksPage.tsx` | Introduce a composable operational header and toolbar while preserving a simpler reading header. |
| Contextual inspector | `frontend/src/tasks/TaskDrawer.tsx`, `frontend/src/components/Dialog.tsx` | Extract reusable inspector structure while retaining Radix focus and dismissal behavior. |
| Task work surface | `frontend/src/routes/TasksPage.tsx`, `frontend/src/tasks/TaskListView.tsx`, `frontend/src/tasks/TaskBoardView.tsx`, `frontend/src/tasks/SprintBar.tsx` | Apply the new operational frame, compress controls, improve persistent scope, and retain keyboard drag behavior. |
| List conventions | `frontend/src/routes/DocumentsPage.tsx`, `frontend/src/routes/MembersPage.tsx`, `frontend/src/routes/admin/AuditLogPage.tsx` | Harmonize row density, metadata alignment, selection, action placement, and responsive overflow. |
| Citation inspection | `frontend/src/routes/AssistantPage.tsx`, `frontend/src/agent/AnswerPanel.tsx`, `frontend/src/routes/DocumentViewer.tsx` | Add optional wide-screen source inspection while preserving complete linear mobile content and deep links. |
| Notes workspace | `frontend/src/routes/NotesPage.tsx`, `frontend/src/notes/NoteEditor.tsx` | Replace negative-margin shell compensation with an explicit split frame while retaining the readable editor width. |
| Tokens and motion | `frontend/src/index.css` | Add spacing, density, frame, and motion-duration tokens without replacing the semantic color system. |
| Shared controls | `frontend/src/components/Button.tsx`, `frontend/src/components/Field.tsx`, `frontend/src/components/Feedback.tsx`, `frontend/src/components/EmptyState.tsx` | Introduce compact operational variants only where the 44-pixel touch and accessibility floor remains protected. |
| Theme and identity | `frontend/src/theme/ThemeToggle.tsx`, `frontend/src/components/Wordmark.tsx`, `frontend/src/workspace/WorkspaceSwitcher.tsx` | Preserve existing identity while refining sidebar density and hierarchy. |

## Validation Criteria for the Enhancement

The refactored interface should preserve every current destination and role boundary. Admin-only navigation and controls must remain conditional, and no visual refactor may imply that an agent proposal has already changed workspace data.

At 1440 pixels wide, Tasks should show its main controls and a useful number of work rows without excessive blank margins. Opening a task should retain visible list or board context. Notes should show its note list and editor without route-specific negative-margin compensation. Documents and administrative lists should use the wider operational canvas.

At 1024 and 768 pixels, toolbars should wrap or collapse without overlapping content. Local board and table scrolling should not cause document-level horizontal overflow. At 360 pixels, navigation should remain a drawer, contextual inspectors should become full-screen detail surfaces, controls should retain usable target sizes, and every workflow should expose an explicit way back.

Keyboard-only validation should cover navigation, workspace switching, search, task creation, board movement, task opening and closing, dialogs, note formatting, document passage selection, review decisions, and account controls. Focus must remain visible and return to a meaningful trigger after a modal or inspector closes.

Reduced-motion validation should confirm that page, drawer, dialog, citation, drag, and programmatic scroll behavior avoid unnecessary movement while continuing to communicate state.

Visual-regression coverage should include light, dark, and system themes; empty, loading, failure, processing, ready, flagged, and permission-restricted states; long workspace, task, file, member, and sprint names; and both sparse and dense datasets.

## Boundaries and Risks

The supplied references should not be treated as a request to recreate another product. MeridianAI's trust-specific signals, reliability note, citation highlight, role boundaries, document processing visibility, and human approval model are differentiators and must remain more prominent than they are in a generic work-management interface.

Increasing density can conflict with touch target size, explanatory clarity, and inspectability. The solution should use better alignment and contextual disclosure rather than indiscriminately shrinking typography and controls.

A reusable inspector can become a second application inside the application if every detail flow is moved into it. Reading-intensive documents and complex administrative decisions may still deserve dedicated pages. Inspector adoption should be based on whether retaining the originating context improves task completion.

The source audit cannot confirm final rendered contrast, clipping, real-data performance, browser behavior, or user comprehension. Those concerns require live responsive inspection and task-based usability validation after the first shell and Tasks refactor slice is available.

## Recommended Starting Slice

The first refactor slice should be limited to `AppShell`, page-frame primitives, the operational header, and Tasks. Tasks exercises list and board density, filters, sprints, quick creation, keyboard interactions, responsive overflow, agent proposals, and a contextual inspector. It is therefore the best surface on which to establish the new professional workspace baseline.

The slice should preserve existing task data hooks and mutation behavior. Its success criterion is a clearer and more spacious desktop work surface with a shallower control hierarchy, not a feature rewrite. Once validated in light, dark, desktop, tablet, mobile, keyboard, and reduced-motion modes, the same primitives can be adopted incrementally by Notes, Documents, Members, and administrative routes.
