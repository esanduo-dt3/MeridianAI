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

- **Radius.** Controls use `--radius-control` (8 px). Panels use `--radius-panel` (12 px). Pills are only for status chips.
- **Shadows.** Shadows are tinted, not black: `--shadow-panel` for resting panels, `--shadow-lift` for drawers.
- **Motion.** Motion must communicate something:
  - page entry: 8 px rise, 350 ms;
  - the navigation marker slides between items (spring);
  - the citation highlight sweeps in reading order;
  - the mobile drawer slides in.
- **Reduced motion.** Every animation checks `useReducedMotion`, and a global rule shortens CSS transitions to near zero.

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

## Accessibility floor

- Visible focus ring (2 px cobalt) on every interactive element.
- A "Skip to content" link. Focus moves to the main region on navigation.
- Icon-only buttons have `aria-label`s. Decorative icons are `aria-hidden`.
- Touch targets are at least 44 px. The layout works from 360 px wide, and the sidebar becomes a drawer below 1024 px.
- Errors use `role="alert"` and state what happened and how to fix it.
