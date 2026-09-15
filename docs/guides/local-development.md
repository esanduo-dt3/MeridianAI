# Local development

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 24+ | `node -v` |
| npm | 11+ | `npm -v` |
| Python | 3.13 ([D-014](../decisions.md#d-014)) | `python3.13 --version` |
| PostgreSQL client and server | 16+, for migrations and local access tests | `psql --version` |

## 1. Configure environment files

Both `.env` files are git-ignored. Never commit them, and never put the service-role key in the frontend.

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

| File | Variable | Value |
| --- | --- | --- |
| `frontend/.env` | `VITE_SUPABASE_URL` | `https://igzjmigtofnpnsaaxmul.supabase.co` |
| | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key |
| | `VITE_API_BASE_URL` | `http://localhost:8000` |
| `backend/.env` | `SUPABASE_URL` | Same as above |
| | `SUPABASE_PUBLISHABLE_KEY` | Same as above |
| | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → service role |
| | `DATABASE_URL` | Supabase → **Connect** → Session pooler connection string, with the database password filled in |
| | `GEMINI_API_KEY` | Google AI Studio (needed from the retrieval work onward) |
| | `FRONTEND_ORIGIN` | `http://localhost:5173` |

## 2. One-time Google sign-in setup

1. **Google Cloud Console → Credentials → your OAuth 2.0 client:**
   - Authorized redirect URI: `https://igzjmigtofnpnsaaxmul.supabase.co/auth/v1/callback`
   - Authorized JavaScript origin: `http://localhost:5173`
2. **Supabase → Authentication → Sign In / Providers → Google:** enabled, with that client's ID and secret.
3. **Supabase → Authentication → URL Configuration → Redirect URLs:** add `http://localhost:5173/**`.
4. If the Google consent screen is in **Testing**, add each tester under **Test users**.

| Symptom | Cause |
| --- | --- |
| `redirect_uri_mismatch` | Step 1's redirect URI is missing, or Google hasn't applied it yet (can take a few minutes) |
| Signed in but land on the wrong site | Step 3 is missing |
| "Access blocked" | Step 4 |

## 3. Database

```bash
scripts/db/test-local.sh     # optional: prove migrations and access rules on a throwaway local database
scripts/db/migrate.sh        # apply pending migrations to Supabase (uses DATABASE_URL)
```

More in [database.md](database.md).

## 4. Run the backend

```bash
cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest -q
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Check it with `curl localhost:8000/health`, which returns `{"status":"ok"}`. API docs are at http://localhost:8000/docs.

## 5. Run the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build
npm run lint
```

Open **http://localhost:5173**, not `127.0.0.1`. The OAuth redirect and CORS are configured for `localhost`.
