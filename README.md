# Meridian

Meridian is an AI-native workspace for notes, documents and tasks. Its agent answers questions from your workspace and cites the exact passage behind every answer. It can propose a task, but nothing is written to the workspace until a person approves it.

## Reliability note

AI-generated answers and agent actions may be incomplete or wrong. Every answer carries a chunk-level source citation and a stated confidence value. **That confidence value is uncalibrated**, so it is not a probability that the answer is correct. Low-confidence or ungrounded answers are routed to human review.

## Repository layout

| Path | Contents |
| --- | --- |
| `frontend/` | React web app (Vite, TypeScript, Tailwind) with Supabase Google sign-in |
| `backend/` | FastAPI service: token verification, workspace scoping, and the retrieval and agent pipeline as it lands |
| `supabase/` | SQL migrations and database access-rule tests |
| `scripts/` | Database migration and test tooling |
| `docs/` | Product, architecture, guides, decision log and build progress |
| `Meridian_PRD_v2.pdf` | Product requirements |

## Quick start

```bash
cp frontend/.env.example frontend/.env && cp backend/.env.example backend/.env   # then fill them in
cd backend && python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

The full setup, including the one-time Google OAuth configuration, is in [docs/guides/local-development.md](docs/guides/local-development.md).

## Documentation

Start at [docs/README.md](docs/README.md). Deviations from the PRD are recorded in [docs/decisions.md](docs/decisions.md), and current status is in [docs/progress.md](docs/progress.md).
