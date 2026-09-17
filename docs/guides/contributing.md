# Contributing

The rules below are recorded in [D-002](../decisions.md#d-002).

## Branches

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Releasable state | Never force-pushed; updated from `dev` |
| `dev` | Integration | Base for all feature work |
| `feature/<slug>` | One piece of work | Cut from `dev`, merged back when complete |

Feature branches so far: `feature/frontend-scaffold`, `feature/backend-scaffold`, `feature/database-schema`, `feature/documentation`.

## Commits

- Commit when a task or subtask is complete, not at the end of the day.
- Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope:
  - `feat(frontend): add Google sign-in screen`
  - `feat(db): add core schema with workspace-scoped RLS`
  - `docs: add decision log`
  - `chore(repo): ignore local claudeSkills folder`
- Author everything as the DigitalT3 account. The repository sets it locally:
  ```bash
  git config --local user.name "esanduo-dt3"
  git config --local user.email "esanduo@digitalt3.com"
  ```
- Do not add `Co-Authored-By` trailers for AI tools.
- Do not commit or push without the product owner's go-ahead during the Week 1 build.

## Never commit

- `.env` files (ignored repo-wide; only `.env.example` is tracked)
- `claudeSkills/` (local design guidance, ignored)
- `node_modules/`, `dist/`, `.venv/`, caches

## Definition of done for a change

1. **Frontend:** `npm run build` and `npm run lint` pass.
2. **Backend:** `pytest` passes.
3. **Database:** `scripts/db/test-local.sh` passes.
4. Every screen touched has loading, empty and error states.
5. Docs describing the changed behaviour are updated, and any PRD deviation is in [decisions.md](../decisions.md).
6. [progress.md](../progress.md) reflects the new state.
