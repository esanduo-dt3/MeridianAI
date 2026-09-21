[CodeWiki](../../index.md) / [Artifacts](../index.md) / [UI/UX](index.md)

# Meridian UI/UX Refactor Target and Guardrails

## Status and Purpose

This document defines the approved target for the MeridianAI UI/UX refactor. It converts the findings in the completed [UI/UX baseline and refactor audit](meridian-ui-ux-baseline-and-refactor-audit.md) into a concrete outcome, bounded scope, protected behavior contract, and measurable definition of completion.

The refactor is approved as a presentation and interaction enhancement across the existing frontend. Its purpose is to make MeridianAI feel like a professional, information-rich workspace rather than a collection of individually styled pages. It must improve hierarchy, density, navigation continuity, responsive behavior, and useful motion without changing MeridianAI's product rules, data behavior, authorization model, or trust guarantees.

This target is not an implementation plan. It defines what the refactor must achieve and the conditions it must satisfy. File-level sequencing and development tasks can be derived from these guardrails after approval.

## Approved Experience Target

### Professional Workspace Model

The authenticated application must adopt a consistent workspace structure consisting of persistent global navigation, a route-appropriate main work surface, and an optional contextual inspector. The existing desktop sidebar remains the global navigation layer and continues to expose workspace switching, ordinary destinations, administrator-only destinations, theme controls, reliability messaging, and account controls.

The main work surface must no longer use one centered maximum width for every route. Reading-oriented content must retain a constrained measure, while operational screens must use the available viewport and split workflows must be able to show navigation or context beside the primary content.

The approved page-frame modes are:

| Frame | Intended use | Required outcome |
| --- | --- | --- |
| Reading | Assistant answers, note bodies, and long-form document passages | Text retains a readable line length and does not stretch across the full viewport. |
| Operational | Tasks, Documents, Members, Review Queue, Audit Log, and Pipeline Health | Lists, boards, filters, tables, and status information use the available width without excessive blank margins. |
| Split workspace | Notes and contextual list-detail workflows | A list or navigation pane can remain visible beside the primary content on wide screens without route-specific negative-margin workarounds. |
| Contextual inspector | Task details first, with later reuse only where justified | Detail can open without discarding the originating work surface on wide screens and becomes a focused full-screen surface on small screens. |

### Visual Hierarchy and Density

Operational routes must use shallower headers, aligned metadata, subdued separators, and a predictable arrangement of route identity, view selection, search, filters, scope, and primary actions. Large display headings and generous editorial spacing remain appropriate for onboarding, empty first-run experiences, and reading surfaces, but they must not routinely push operational content below the fold.

Greater density must come from better alignment, use of horizontal space, concise supporting copy, and contextual disclosure. It must not be achieved by indiscriminately shrinking typography or interaction targets. Controls used on touch layouts must continue to meet the documented 44-pixel accessibility floor.

Graphite and mineral surfaces, semantic spacing, restrained borders, and selective depth remain the visual foundation. Shadows are reserved for lifted elements such as inspectors, dialogs, drag overlays, and other genuinely elevated surfaces. Dense operational rows should not become collections of visually heavy cards.

### Meridian Identity

The refactor must preserve MeridianAI's existing “precise instrument” identity. Cobalt continues to communicate current location, focus, links, and primary action. Yellow remains exclusive to cited source text and must not be reused for promotion, selection, decoration, or general status.

The Bricolage Grotesque, Geist, and Geist Mono typography roles remain intact. The existing semantic token model and light, dark, and system themes must be refined rather than replaced. Components must continue to consume semantic tokens instead of introducing route-specific raw colors.

The supplied screenshots are references for workspace hierarchy, contextual continuity, and information density. They are not a request to reproduce another product's branding, navigation taxonomy, feature set, or exact visual styling.

### Purposeful Motion

Motion must explain origin, destination, hierarchy, or system activity. Appropriate examples include the active navigation marker moving between destinations, an inspector entering from its attached edge, a selected citation revealing its source, a drag overlay lifting from the board, or an ingestion indicator communicating active processing.

Routine operational feedback should normally complete within approximately 120 to 220 milliseconds. Longer motion is acceptable only where it supports comprehension, such as citation provenance or an explanatory first-run sequence. Decorative looping animation, delayed access to controls, and motion that does not communicate state are outside the target.

Every new animation must have a reduced-motion result that communicates the same state without unnecessary displacement. Programmatic scrolling in the assistant and document inspection flows must respect the user's reduced-motion preference rather than always requesting smooth scrolling.

## Refactor Scope

### In-Scope Surfaces

The approved target covers the complete implemented frontend experience, but it permits incremental delivery. Each route remains responsible for its domain-specific content while adopting shared framing, hierarchy, density, and responsive conventions.

| Surface | Approved refactor target |
| --- | --- |
| Application shell | Introduce explicit reading, operational, and split frame behavior while preserving persistent desktop navigation and the mobile navigation drawer. |
| Tasks | Establish the professional operational baseline with a compact header, coordinated toolbar, fluid list and board canvas, persistent sprint context, and accessible task inspection. |
| Assistant | Preserve readable answers while improving composition of conversation, citations, source passages, answer signals, and the sticky composer. |
| Notes | Replace shell-padding compensation with an intentional split workspace while retaining the constrained editor canvas and focused mobile note flow. |
| Documents | Improve upload hierarchy, processing visibility, document-row density, and wide-screen inspection without losing document deep links. |
| Members | Harmonize headers, metadata alignment, role controls, invitation states, and destructive-action presentation with the operational workspace. |
| Review Queue | Improve scanability and decision hierarchy while preserving the explicit human review boundary. |
| Audit Log | Improve filter, row, and detail consistency without weakening attribution or recorded evidence. |
| Pipeline Health | Use the operational canvas for metrics and tabular evidence while keeping real values and bounded table overflow visible. |
| Shared components | Extend page headers, toolbars, rows, status treatments, feedback, dialogs, and inspector framing instead of creating unrelated local patterns. |
| Responsive and motion systems | Standardize breakpoints, bounded overflow, panel adaptation, durations, easing, and reduced-motion behavior. |

Authentication, welcome, not-found, loading, error, empty, permission-restricted, and destructive-confirmation states are included where visual consistency or responsive behavior is affected. Their product logic is protected.

### First Delivery Slice

The first delivery slice is deliberately limited to the application shell, explicit page-frame primitives, a composable operational header and toolbar, and the Tasks route. Tasks is the proving surface because it exercises list and board layouts, sprint scope, search, filtering, quick creation, agent proposals, keyboard interactions, responsive overflow, and contextual detail.

This slice establishes reusable UI contracts; it does not complete the whole-application refactor. Notes, Documents, Members, Assistant, and administrative routes should adopt the proven primitives incrementally after the shell and Tasks experience passes the completion criteria applicable to that slice.

Later routes must not be redesigned through one-off replacements while the shared framing contract remains unresolved. Conversely, the first slice must not include speculative changes to every route merely to make the interface appear uniformly changed.

### Out-of-Scope Changes

The refactor must not alter backend APIs, database schemas, retrieval behavior, agent tool selection, task mutation semantics, document ingestion rules, note persistence, authentication, workspace membership, or authorization enforcement.

It must not add unapproved product capabilities, sample data, placeholder metrics, new navigation destinations, calendar integrations, whiteboards, diagrams, or other roadmap features. Existing screens must continue to represent only real repository-backed behavior and real data.

The work must not change route ownership or remove deep-linkable state merely to simplify presentation. It must not replace accessible native controls unless a custom control provides a justified functional improvement and preserves equivalent keyboard and assistive-technology behavior.

The refactor must not reinterpret an agent proposal as an executed action, weaken review or destructive confirmation, hide confidence labelling, remove citation offsets, or reduce processing and error visibility for the sake of visual simplicity.

## Protected Behavior Contract

### Routing and Application Shell

The authenticated destinations mounted beneath `AppShell` must remain available: Tasks, Assistant, Notes, Documents, Members, Review Queue, Audit Log, and Pipeline Health. Note and document detail routes must continue to support direct navigation. Existing redirects, including `/ask` to `/assistant` and `/admin/members` to `/members`, must remain valid unless separately approved as a routing change.

Workspace selection and workspace-scoped content remain mandatory. Administrator navigation must remain conditional, and visual hiding must never replace route-level and API-level authorization.

The desktop sidebar must remain persistent at supported desktop widths. Below the desktop breakpoint, navigation must remain an accessible drawer with an explicit open control, an explicit close control, Escape dismissal, and no document-level horizontal overflow.

The “Skip to content” link and focus movement to the main region after route navigation are non-negotiable. A frame refactor must not remove or bypass either behavior.

### Tasks

Task list and board views must continue to represent the current task data and mutations. The `view`, `sprint`, and open `task` URL parameters must remain meaningful so the visible task context can be revisited and shared.

Search, completed-item visibility, sprint scoping, hierarchy, subtasks, due dates, priority, assignee, status, progress, and source provenance must remain available where currently supported. The `/` shortcut must continue to focus task search, and task quick creation must retain its existing keyboard path.

Pointer and keyboard drag-and-drop must continue to support movement and reordering across board columns. Screen-reader instructions and announcements for picking up, moving, dropping, and cancelling a task must remain available. The board may scroll horizontally inside its own bounded region, but it must not cause the application document to overflow horizontally.

Opening a task must retain access to status, priority, sprint, assignee, due date, description, subtasks, provenance, timestamps, and permitted edit or delete actions. Members may continue to change task status, while administrator-only edits and destructive actions remain protected.

Agent-proposed tasks must remain visibly distinct from committed tasks until an administrator approves them. The refactor must not imply that a proposal has written data before approval.

### Assistant and Trust Signals

The Assistant remains the single place to ask about workspace work and documents. Its underlying tool choice, conversation behavior, injection handling, and proposal behavior are not part of the visual refactor.

Document answers must continue to expose exact source citations, character-level passage inspection, groundedness, review status, and a confidence value explicitly labelled as uncalibrated. The reliability note and injection warning must remain visible in the contexts where they currently communicate risk.

Task suggestions produced by the Assistant must remain proposals waiting for administrator approval. No visual treatment may present them as completed writes.

A wide-screen source inspector may supplement the answer layout, but it must not remove citations or source information from the semantic reading order. On small screens, all answer and source content must remain reachable in a coherent linear flow.

### Notes and Documents

Notes must continue to support list search, note creation, deep-linked selection, block editing, slash commands, save-state feedback, deletion rules, and the focused mobile flow between list and selected note. The editor body must retain its readable width even when its surrounding workspace becomes fluid.

Documents must continue to support PDF and Word upload, the current file-size rule, workspace targeting, visible processing and embedding progress, ready and failed states, retry behavior, passage counts, deep-linked inspection, and destructive confirmation. A document may gain contextual wide-screen inspection, but `/documents/:documentId` must remain a valid representation of the selected document.

Yellow highlighting must remain reserved for cited passage ranges. Uploading, processing, failure, retry, and deletion consequences must not be hidden in overflow-only interactions.

### Administration and Authorization

Members, Review Queue, Audit Log, and Pipeline Health must continue to expose only actions permitted by the current role model. Invitation state, membership role, human review decisions, audit attribution, and pipeline values remain product evidence rather than decorative content.

The review boundary must remain explicit. Low-confidence, ungrounded, or otherwise flagged material must not be made to look resolved through styling alone. Pipeline metrics must continue to display real values rather than invented estimates or decorative trends.

### Accessibility and Feedback

Visible focus, semantic labels, assistive announcements, error alerts, dialog focus management, meaningful focus return, and keyboard access must survive the refactor. Icon-only controls require accessible names, and status must continue to use text or icons rather than color alone.

Loading, empty, error, saving, uploading, processing, ready, permission-restricted, pending-approval, and destructive states must remain explicit. Increasing density must not turn informative states into unexplained blank space or ambiguous iconography.

## Completion Criteria

### Workspace and Visual Criteria

| Criterion | Required evidence |
| --- | --- |
| Route-appropriate framing | Reading content remains constrained, operational routes use the available canvas, and split routes no longer compensate for the shell with negative margins. |
| Professional hierarchy | Route identity, current scope, view controls, filters, and primary actions are visually ordered and do not unnecessarily displace the work surface. |
| Context continuity | Opening task detail at a wide desktop viewport leaves meaningful list or board context visible or immediately recoverable. |
| Consistent density | Tasks, document rows, member rows, audit entries, and administrative controls use a shared spacing and interaction vocabulary without erasing domain differences. |
| Meridian identity | Cobalt, citation yellow, semantic status colors, typography roles, radii, and restrained depth follow the existing design system in light and dark themes. |
| Honest states | Empty and sparse datasets remain truthful and instructive; the interface introduces no fabricated rows, metrics, activity, or placeholders presented as real data. |

At a 1440-pixel viewport, Tasks must use the wider work surface, expose its principal controls without an oversized header stack, and show a useful amount of list or board content. Opening a task must preserve visible work context. Notes must present its list and editor as an intentional split workspace, and operational document and administrative routes must not remain confined to the old universal 1080-pixel frame.

At 1024 and 768 pixels, headers and toolbars must wrap, collapse, or scroll within a clearly bounded control region without overlap. At 360 pixels, global navigation must remain a drawer, contextual detail must become a focused full-width experience, touch targets must remain usable, and every list-detail workflow must provide a clear path back.

Only a board, table, or similarly bounded work region may scroll horizontally. The application document itself must not acquire horizontal overflow at the supported viewport widths.

### Behavioral Regression Criteria

Every existing destination, redirect, deep link, role boundary, query-backed view state, and destructive confirmation must remain functional. The refactor is incomplete if a route looks improved but loses workspace scope, permission clarity, data state, error recovery, or a supported action.

Tasks validation must cover list and board views, filtering, sprint scopes, completed visibility, quick creation, task opening and closing, member status changes, administrator editing, proposal approval boundaries, subtasks, pointer dragging, keyboard dragging, and screen-reader announcements.

Assistant validation must cover ordinary replies, cited document answers, multiple source passages, confidence and groundedness signals, injection warnings, proposal cards, failures, pending responses, and reduced-motion scrolling.

Notes and Documents validation must cover empty and populated lists, deep-linked details, long names and content, save or ingestion progress, failures, retry paths, deletion confirmation, and mobile return navigation. Administrative validation must cover both authorized and unauthorized presentation.

### Accessibility and Motion Criteria

Keyboard-only validation must include global navigation, workspace switching, route controls, search, filters, task creation, board movement, task inspection, dialogs, note editing controls, document passage selection, review decisions, theme controls, and account controls.

Focus must remain visibly styled. Opening a modal or inspector must move focus into it according to the interaction pattern, and closing it must return focus to a meaningful trigger or work item. Route changes must continue to focus the main content region.

Reduced-motion validation must confirm that route transitions, navigation markers, drawers, inspectors, dialogs, citation reveals, drag feedback, progress indicators, and programmatic scrolling communicate state without unnecessary movement. Disabling displacement must not remove loading or progress information.

### Theme, Content, and State Coverage

Visual verification must include light, dark, and system theme behavior. It must cover empty, loading, failure, permission-restricted, saving, uploading, processing, ready, grounded, flagged, pending-approval, and destructive-confirmation states.

Layouts must be checked with both sparse and dense data as well as long workspace, sprint, task, file, note, and member names. Text must truncate or wrap deliberately, and primary actions, status, and destructive controls must remain available to keyboard and touch users.

Final contrast, clipping, browser behavior, real-data rendering performance, and user comprehension require live application validation. Source review alone is not sufficient evidence of completion.

## Definition of Done

The UI/UX refactor is complete only when all implemented frontend surfaces use the approved workspace hierarchy or an explicitly justified reading layout, while all protected behavior remains operational. Shared primitives must be used where they solve recurring framing, header, toolbar, row, feedback, or inspector needs; route-level exceptions must be intentional rather than compensations for the shell.

Completion requires responsive inspection at 1440, 1024, 768, and 360 pixels, keyboard-only verification, reduced-motion verification, light and dark theme review, representative state coverage, and regression validation for routing, authorization, deep links, task interactions, citations, approval boundaries, note persistence, document processing, and administrative evidence.

The first shell-and-Tasks slice is complete when it satisfies the applicable criteria above and establishes stable primitives suitable for adoption by the remaining routes. The entire enhancement is not complete until Assistant, Notes, Documents, Members, Review Queue, Audit Log, and Pipeline Health have been migrated or explicitly accepted in their existing presentation.

## Evidence and Limitation

This target is based on the completed source-level audit, the current route hierarchy and shell, the implemented task, assistant, note, and document workflows, and the repository's product and design-system guidance. The supplied screenshots influenced the target through the audit's analysis of persistent context, dense work surfaces, layered navigation, and restrained dark styling.

No running application container or authenticated live session was available when the baseline audit was completed. Consequently, the target defines required runtime validation rather than claiming that contrast, clipping, real-data density, browser behavior, or task-completion quality has already been verified.
