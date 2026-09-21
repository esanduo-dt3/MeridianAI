# Meridian documentation

Meridian is an AI-native workspace where every AI answer cites the exact passage it came from, and the agent never changes the workspace without a person's approval.

## Start here

| If you want to… | Read |
| --- | --- |
| Run the app on your machine | [guides/local-development.md](guides/local-development.md) |
| Understand what is being built and why | [product/overview.md](product/overview.md) |
| Know who can do what | [product/roles-and-permissions.md](product/roles-and-permissions.md) |
| See how the pieces fit together | [architecture/overview.md](architecture/overview.md) |
| Learn how documents are ingested | [architecture/ingestion.md](architecture/ingestion.md) |
| Learn how questions are answered | [architecture/retrieval.md](architecture/retrieval.md) |
| Learn how the Assistant agent works | [architecture/agent.md](architecture/agent.md) |
| See every pipeline number and why | [architecture/pipeline-parameters.md](architecture/pipeline-parameters.md) |
| See what to improve in the pipeline | [architecture/pipeline-review.md](architecture/pipeline-review.md) |
| Look up a table or column | [architecture/data-model.md](architecture/data-model.md) |
| Look up an endpoint | [architecture/api.md](architecture/api.md) |
| Change the database | [guides/database.md](guides/database.md) |
| Contribute a change | [guides/contributing.md](guides/contributing.md) |
| Deploy to Railway | [guides/deployment.md](guides/deployment.md) |
| Build UI that fits | [design/design-system.md](design/design-system.md) |
| See why something differs from the PRD | [decisions.md](decisions.md) |
| See what is done and what is next | [progress.md](progress.md) |

## Sources of truth

- **`Meridian_PRD_v2.pdf`** is the product requirements. Where this documentation differs, [decisions.md](decisions.md) records the approved change.
- **`kavia-docs/projectContext.md`** holds the Week 1 non-negotiables and MUST scope, as given to the build.
- **`kavia-docs/`** holds the Kavia-assisted record: the original scaffold plan, the PRD summary and the kickoff prompts from the first build attempt ([D-001](decisions.md#d-001)), plus the CodeWiki written during the later UI/UX work. Its entry point is `kavia-docs/CodeWiki/index.md`. The architecture and frontend pages there are kept in sync with the code; the plans and audits under `kavia-docs/CodeWiki/Artifacts/` are point-in-time records and are not updated after the fact.
- **The code and migrations** are authoritative for current behaviour. These docs are updated in the same change as the code they describe.

## Writing these docs

- Describe what exists now. Put plans in [progress.md](progress.md), not in reference pages.
- Record every decision that is not verbatim in the PRD in [decisions.md](decisions.md), in the same change.
- Link, don't copy. Each fact lives in one page.
