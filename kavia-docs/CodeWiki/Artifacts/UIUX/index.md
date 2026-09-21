[CodeWiki](../../index.md) / [Artifacts](../index.md) / [UI/UX](index.md)

# UI/UX Artifacts

These documents record the two rounds of interface work on the MeridianAI frontend. Each round produced a baseline audit of the interface as it then existed, followed by an approved target that converted the audit findings into a bounded scope with a protected behavior contract.

| Document | Round | Purpose |
| --- | --- | --- |
| [UI/UX Baseline and Refactor Audit](meridian-ui-ux-baseline-and-refactor-audit.md) | First | Audit of the implemented frontend before the refactor, covering hierarchy, density, navigation continuity, and responsive behavior. |
| [UI/UX Refactor Target and Guardrails](meridian-ui-ux-refactor-target-and-guardrails.md) | First | The approved refactor outcome, the page-frame modes, and the behavior that the refactor was forbidden to change. |
| [UI Redesign Baseline Audit](meridian-ui-redesign-baseline-audit.md) | Second | Audit taken after the refactor, focused on the navigation rail, the Tasks prelude, the agent-proposal area, and the first-run surface. |
| [UI Redesign Target and Guardrails](meridian-ui-redesign-target-and-guardrails.md) | Second | The approved redesign target: a collapsible glass rail, a sticky task command bar, a bounded proposal area, and a stronger landing surface. |

The protected contracts named in both targets, including the route set, the keyboard shortcuts, the verbatim Member permission sentence, the skip link and focus behavior, and the citation-only use of the highlight token, are still enforced by the frontend regression suites described in [Frontend UI Architecture](../../Architecture/frontend-ui-architecture.md).
