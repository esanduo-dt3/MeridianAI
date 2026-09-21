# MeridianAI CodeWiki

MeridianAI is an AI-native team workspace in which every assistant answer is grounded in workspace documents, cited down to the exact passage offsets, and in which the agent never writes to the workspace without explicit human approval. This CodeWiki is the navigable entry point to the documentation kept alongside the repository in `kavia-docs/`.

The repository also carries a second, engineer-facing documentation tree under `docs/`, which holds the maintained reference pages for the product, architecture, guides, design system, decision log, and build progress. The CodeWiki pages here describe the system at a higher level and record the planning and UI/UX artifacts produced during the Kavia-assisted work. Where the two disagree, the source code and the database migrations are authoritative, and `docs/decisions.md` records why a behavior differs from the original product requirements.

## Current State

| Page | What it covers |
| --- | --- |
| [Architecture](Architecture/index.md) | The implemented system: ingestion, hybrid retrieval, answer generation, the agent loop, administrative oversight, and the frontend application shell. |
| [Specs](Specs/index.md) | Forward-looking and reference specification material, including the summary of the product requirements document. |
| [Artifacts](Artifacts/index.md) | Generated planning and UI/UX artifacts: scaffold and implementation plans, baseline audits, and approved interface targets. |

## Repository Layout

The application is a two-part deployment. `backend/` is a FastAPI service that owns authentication scoping, document ingestion, retrieval, answer generation, the agent loop, and the administrative endpoints. `frontend/` is a React and TypeScript single-page application built with Vite and Tailwind CSS v4 that renders the public landing page and the authenticated workspace. `supabase/migrations/` holds the schema, row-level security policies, and the SQL functions that perform retrieval and the atomic approval transactions. `backend/evals/` contains the offline golden-set evaluation harness.

## Other Records in This Folder

`projectContext.md` preserves the original Week 1 brief exactly as it was given to the build, including the four non-negotiables, the MUST scope, the data model, and the two delivery gates. It is a historical input rather than a description of current behavior; several items originally deferred to the SHOULD tier, such as the backlog and sprint board and team roles used for assignee suggestions, have since been built and are recorded in `docs/decisions.md`. `Meridian_Kavia_Kickoff_Prompts.md` preserves the kickoff prompts used to start the work.
