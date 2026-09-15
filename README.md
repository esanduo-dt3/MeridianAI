# MeridianAI

MeridianAI is an AI-native workspace that combines block-tree notes with a retrieval-grounded
agent. The agent answers questions from workspace content with chunk-level citations, and any
change it wants to make to the workspace is **proposed for human approval** rather than applied
silently. All data is scoped to a workspace and protected by row-level security in Supabase.

## Reliability note

Answers produced by the agent may be wrong. Every answer carries at least one chunk-level
citation unless it is explicitly labelled as general knowledge, and every answer carries a
stated confidence value. **That confidence value is uncalibrated** and must not be read as a
probability of correctness. Verify cited sources before acting on an answer.

## Repository layout

| Path | Purpose |
| --- | --- |
| `frontend/` | React + TypeScript + Vite application (Supabase Auth, Google sign-in) |
| `backend/` | FastAPI service (Supabase JWT verification, workspace-scoped APIs) |
| `kavia-docs/` | CodeWiki: specs, plans and onboarding documentation |
| `assets/` | Static assets shared across the project |

`frontend/` and `backend/` are added by the scaffolding steps that follow the repository baseline.

## Branch and commit conventions

- `main` — releasable state. Never force-pushed.
- `dev` — integration branch and the base for all feature work.
- `feature/<slug>` — one branch per feature, merged into `dev` when its task or subtask completes.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with a scope
naming the container or plane, for example `feat(frontend): add Supabase Google sign-in` or
`chore(repo): initialize main and dev branches`.

## Configuration

Neither container reads secrets from source. Each container documents its required variables in a
committed `.env.example`; real values live in an untracked `.env` file or a deployment secret
store. `.env` files are git-ignored repository-wide.
