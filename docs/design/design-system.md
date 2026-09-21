# Design system

The rationale is in [D-016](../decisions.md#d-016). Tokens live in [`frontend/src/index.css`](../../frontend/src/index.css) as Tailwind v4 `@theme` variables. Components use the token utilities (`bg-paper`, `text-ink-2`, `bg-cobalt`), never raw hex values.

## Direction

Meridian should feel like a precise instrument: calm, exact, and easy to check. Its one moment of emphasis is the link between an answer and its source.

- **The meridian line.** A cobalt rule marks where you are (the active navigation item) and what an answer is measured against (the connector to its source).
- **The highlighter.** Yellow `mark` is used **only** for cited source passages. Never use it for emphasis, promotion or status.
- **Honest emptiness.** Screens without real data say so plainly and tell the user what fills them. No sample rows, no placeholder metrics.

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#f4f5f2` | Page background |
| `surface` | `#ffffff` | Panels, cards, inputs |
| `sunken` | `#eceee9` | Hover fills, icon wells |
| `ink` | `#111418` | Primary text, primary buttons |
| `ink-2` | `#454d57` | Secondary text |
| `ink-3` | `#69717b` | Tertiary text, captions (AA on white) |
| `rule`, `rule-strong` | `#e1e4df`, `#c9cec8` | Dividers and borders |
| `cobalt`, `cobalt-hover`, `cobalt-wash` | `#2743c9`, `#1f37a8`, `#eaedfb` | The single accent: location, links, focus |
| `mark`, `mark-edge` | `#ffe27a`, `#e7c23a` | Cited passages only |
| `grounded`, `grounded-wash` | `#16704a`, `#e5f1ea` | Groundedness passed |
| `flag`, `flag-wash` | `#9a4e00`, `#fbefe1` | Flagged for review, configuration warnings |
| `danger`, `danger-wash` | `#b42318`, `#fdecea` | Errors, destructive actions |

Status colour always comes with text or an icon, never colour alone.

### Dark theme

Every colour token is redefined under `[data-theme='dark']` in `index.css`. Components never branch on the theme; they use the same token utilities.

| Token | Dark value | Note |
| --- | --- | --- |
| `paper` / `surface` / `sunken` | `#0d0f12` / `#15181c` / `#1c2025` | Graphite, not pure black |
| `ink` / `ink-2` / `ink-3` | `#eceef1` / `#b4bac2` / `#8b939d` | `ink-3` stays above AA on `surface` |
| `on-ink`, `ink-hover` | `#0d0f12`, `#ffffff` | Text and hover on primary (ink-filled) buttons |
| `cobalt` | `#8098ff` | Lifted for contrast on dark surfaces |
| `mark` | `#5b4a0f` | Amber wash, so cited text stays readable |
| `grounded` / `flag` / `danger` | `#52c58e` / `#f0a64a` / `#ff7d74` | With matching dark washes |

- **Default.** The preference is `system`, which follows the operating system. People can switch to Light or Dark with the theme control in the sidebar or on the sign-in page. The choice is stored in `localStorage` under `meridian-theme`.
- **No flash.** An inline script in `index.html` sets `data-theme` before the first paint. `ThemeProvider` keeps it in sync, including live operating-system changes.
- **Colours in code.** Never write raw colours in components. Use `on-ink` for text on an `ink` background, and the `--shadow-*` tokens for shadows.

## Type

| Role | Family | Typical use |
| --- | --- | --- |
| Display | Bricolage Grotesque (variable, `wdth` 90 in the wordmark) | Page titles, empty-state headings, sign-in headline |
| Text | Geist | Body, controls, navigation |
| Mono | Geist Mono | Character offsets, confidence values, ids, status chips |

- Fonts are self-hosted through Fontsource, not loaded from Google.
- Headings use tight negative tracking (`-0.02em` to `-0.045em`).
- Body text is 15 px with relaxed leading, and lines stay under about 65 characters.

## Shape, depth and motion

Controls use `--radius-control` at 8 px, while panels use `--radius-panel` at 12 px. Pills are reserved for compact status labels. Shadows are tinted rather than black: `--shadow-panel` supports resting panels, `--shadow-lift` supports raised drawers and inspectors, and `--shadow-hairline` separates dense controls or rows without adding unnecessary depth.

Operational motion uses `--duration-quick` at 140 ms, `--duration-panel` at 200 ms, and `--duration-emphasized` at 220 ms with `--ease-out-quint`. Route entry in [`AppShell`](../../frontend/src/layouts/AppShell.tsx) is a restrained 4 px rise over 180 ms. The active navigation marker and mobile navigation drawer use springs, the [`Inspector`](../../frontend/src/components/Inspector.tsx) uses the panel duration, and task board drop feedback uses an 180 ms transition. Motion must explain entry, movement, selection, or changing context rather than decorate a static surface.

Reduced motion is enforced in layers. The global `prefers-reduced-motion` rule in [`index.css`](../../frontend/src/index.css) reduces CSS animation and transition durations and restores automatic scroll behavior. Components using `motion/react`, including `AppShell`, replace displacement with no movement or opacity-only feedback when `useReducedMotion` requests it. Programmatic scrolling in [`AssistantPage`](../../frontend/src/routes/AssistantPage.tsx) and [`DocumentViewer`](../../frontend/src/routes/DocumentViewer.tsx) explicitly switches from `smooth` to `auto`.

## Workspace composition

### Route-owned frames

[`PageFrame`](../../frontend/src/layouts/PageFrame.tsx) gives each authenticated route ownership of its responsive canvas while `AppShell` continues to own navigation, route focus transfer, the mobile drawer, and route-entry motion. Every frame is centered, fills the available width, uses `--frame-gutter`, and applies consistent vertical padding.

| Mode | Width token | Intended use | Current routes |
| --- | --- | --- | --- |
| `reading` | `--frame-reading`, 1080 px | Linear reading and composition where line length matters more than maximum density | Assistant |
| `operational` | `--frame-operational`, 1440 px | Lists, boards, administration, filters, status, and primary workspace actions | Tasks, Documents, Members, Review Queue, Audit Log, and Pipeline Health |
| `split` | `--frame-split`, 1600 px | A persistent list or passage navigator beside focused working content | Notes and Document Viewer |

Frame selection is declared in the route tree in [`App.tsx`](../../frontend/src/App.tsx), not inferred from the pathname inside the shell. New authenticated routes must select the narrowest mode that supports their actual content instead of reintroducing local maximum widths, negative shell margins, or shell-padding compensation.

### Reading and operational headers

[`PageHeader`](../../frontend/src/components/PageHeader.tsx) remains the heading for reading-oriented and simple pages. [`OperationalHeader`](../../frontend/src/components/OperationalHeader.tsx) is the dense-workspace counterpart: it composes an optional eyebrow, one `h1`, supporting description, concise status, and primary actions. Its action region wraps, and its identity region limits prose to 72 characters so route context remains readable beside controls.

[`WorkspaceToolbar`](../../frontend/src/components/WorkspaceToolbar.tsx) groups search, filtering, scope, and view controls beneath an operational header. It is an accessible labelled section, supports trailing guidance or status, and uses `bounded-overflow` so unusually wide controls remain inside the toolbar instead of widening the document. Toolbars should retain native input, select, checkbox, and button semantics.

### Navigation rail and glass material

The desktop navigation rail in [`AppShell`](../../frontend/src/layouts/AppShell.tsx) collapses between `--rail-expanded` (248 px, the default) and `--rail-collapsed` (72 px) through a labelled control with a correct `aria-expanded` state. The choice persists in `localStorage` via [`railPreference`](../../frontend/src/layouts/railPreference.ts), mirroring the read/write pattern in `ThemeProvider`, and degrades to an in-memory choice when storage is unavailable. The grid column is driven by an inline style rather than a utility class because the width is a runtime value; the rail and the app grid must read from the same token pair rather than duplicating widths. Collapsed labels stay in the accessibility tree as `sr-only` text with a matching `title` tooltip, so every destination keeps its existing accessible name in both states. The collapse preference only applies at and above the `lg` breakpoint; the mobile drawer always renders expanded.

`--glass-surface`, `--glass-raised`, `--glass-edge`, and `--glass-blur` are the single declared source for the translucent, blurred material used by the rail and the Tasks command bar, with dark redefinitions under `[data-theme='dark']`. No component introduces ad-hoc opacity or blur utilities for this material; new glass surfaces must consume these tokens.

### Tasks command bar

[`TaskCommandBar`](../../frontend/src/tasks/TaskCommandBar.tsx) replaces Tasks' previously stacked header, toolbar, and sprint bands with one sticky, glass-painted band of at most two rows: route identity, the workspace name, open/done counts, view tabs, the filter field, and the completed toggle in the first row, with `SprintBar`'s scope strip in the second. It sits at `z-20`, below the mobile top bar, drawer, inspector, and dialog/menu layers, and parks under the mobile top bar (`top-14`) or the viewport edge on desktop (`lg:top-0`) so it never overlaps another sticky or overlay surface. `TaskCommandBar` is purely presentational — `TasksPage` keeps all state, URL parameters, and keyboard shortcuts — and `SprintBar` keeps its existing module path and prop contract so its second-row scope strip and disclosure-based sprint management stay covered by the Tasks regression suite. `OperationalHeader` and `WorkspaceToolbar` are unchanged and continue to serve Documents, Members, and the three Admin routes; only Tasks uses the command bar.

The agent-proposal area (`ProposalsPanel`) is bounded to three visible rows before an explicit "Show all" control, with each proposal's description and reasoning behind a per-row disclosure wired through `aria-expanded`/`aria-controls`. Approve and Reject stay on the collapsed row for Admins so a decision is never less visible than the suggestion it acts on, and pending state is isolated per proposal.

### Contextual inspectors

[`Inspector`](../../frontend/src/components/Inspector.tsx) is the shared Radix Dialog shell for contextual details and actions. It renders as a full-width right-edge sheet below the `sm` breakpoint and supports 420, 500, or 560 px maximum widths above that breakpoint. The overlay, border, surface, shadow, hidden accessible title and description, and labelled [`InspectorClose`](../../frontend/src/components/Inspector.tsx) control belong to the shared shell; domain fields, mutations, permissions, and destructive confirmations remain with the caller.

[`TaskDrawer`](../../frontend/src/tasks/TaskDrawer.tsx) is the current domain integration. Radix owns modal focus containment, Escape dismissal, and normal focus restoration behavior. The component regression suite verifies that focus enters the inspector and that its labelled close control and Escape dismiss it. Actual focus return from the real URL-controlled task opener remains a browser-level verification requirement.

### Density and overflow

`--density-row` establishes a 42 px operational row rhythm. It is a layout token, not permission to compress every control: default `Button` controls retain their 44 px floor, mobile navigation controls use 44 px targets, and compact 40 px controls are limited to dense operational compositions where their labels and surrounding spacing remain usable.

The document body clips accidental horizontal overflow. Deliberately wide content must own an explicit local scrolling region. The `bounded-overflow` utility adds horizontal scrolling, inline overscroll containment, and stable scrollbar space; it is used by workspace toolbars, the three-column [`TaskBoardView`](../../frontend/src/tasks/TaskBoardView.tsx), and the Pipeline Health table. Code blocks and expanded audit details own their own overflow. Ordinary page frames, lists, forms, and reading content must not create document-level horizontal scrolling.

## Components

| Component | Rule |
| --- | --- |
| `Wordmark` | Type-only mark with the cobalt bar. No image logo |
| `Button` | Variants `primary`, `secondary`, `ghost`. At least 44 px tall. Shows a spinner and `aria-busy` while loading |
| `ConfidenceLabel` | **The only way to render confidence.** Always shows "uncalibrated" and explains the value on hover |
| `ReliabilityNote` | Full and compact forms of the required reliability note |
| `CitationSpecimen` | Sign-in illustration built from real project text and real offsets, captioned as an example |
| `EmptyState` | Icon, heading, one or two sentences, optional action |
| `PageHeader` | Title, description, and an optional "Not built yet" chip for surfaces whose backend has not landed |
| `PageFrame` | Route-owned `reading`, `operational`, or `split` canvas. The shell must not impose another universal content cap |
| `OperationalHeader` | Operational route identity, concise status, and primary actions with one semantic page heading |
| `WorkspaceToolbar` | Labelled grouping for dense filters, search, scope, and view controls with locally bounded overflow |
| `Inspector` | Accessible responsive edge sheet for contextual content. Callers retain domain state, permissions, and mutations |
| `TaskCommandBar` | Sticky two-row glass band for Tasks route identity, counts, view, filter, and sprint scope. Presentational only |

## Accessibility floor

- Visible focus ring (2 px cobalt) on every interactive element.
- A "Skip to content" link. Focus moves to the main region on navigation.
- Icon-only buttons have `aria-label`s. Decorative icons are `aria-hidden`.
- Default touch-oriented controls are at least 44 px. Compact operational controls use the documented density exception rather than changing the global control default.
- The layout is designed from 360 px wide, and the sidebar becomes a drawer below 1024 px. Wide boards, tables, toolbars, code, and audit details must scroll only inside their labelled or visibly bounded regions.
- Errors use `role="alert"` and state what happened and how to fix it.

## Regression coverage

From `frontend/`, `npm run test` invokes the non-interactive Vitest command defined in [`package.json`](../../frontend/package.json). The focused suite complements lint and production build checks but does not replace authenticated browser review.

| Suite | Protected contract |
| --- | --- |
| [`test_ui_foundations.tsx`](../../frontend/src/__tests__/test_ui_foundations.tsx) | All three `PageFrame` modes, skip-link and route-focus behavior, administrator navigation visibility, mobile drawer dismissal, and deterministic inspector focus and dismissal |
| [`test_tasks_page.tsx`](../../frontend/src/__tests__/test_tasks_page.tsx) | URL-backed list, board, sprint, and selected-task context; `/` and `N` shortcuts; Member and Admin boundaries; and task inspection state |
| [`test_trust_and_motion.tsx`](../../frontend/src/__tests__/test_trust_and_motion.tsx) | Citation deep links and highlighting, confidence and groundedness evidence, flagged states, and reduced-motion-aware passage scrolling |
| [`test_continuity_and_admin_evidence.tsx`](../../frontend/src/__tests__/test_continuity_and_admin_evidence.tsx) | Notes selection, mobile return and save status, protected administration, review wording, attributable audit details, real metric denominators, and bounded Pipeline Health overflow |
| [`test_proposals_panel.tsx`](../../frontend/src/__tests__/test_proposals_panel.tsx) | Bounded proposal rows with reveal-all, per-row disclosure wiring, Admin-only Approve/Reject, and per-proposal pending isolation |

Jsdom does not provide reliable rendered geometry, clipping, pointer drag-and-drop, document-level overflow, viewport adaptation, or authenticated role and state evidence. Those behaviors require live browser inspection at the supported widths and themes. Inspector tests likewise do not claim automatic focus restoration from the real task opener because the current inspector is controlled through URL state rather than a Radix Trigger relationship.
