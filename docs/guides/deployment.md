# Deployment

Meridian runs on Railway as one project, `meridian`, with two services: `backend`
(FastAPI) and `frontend` (the built React app). Why Railway: [D-045](../decisions.md#d-045).

| Service | URL |
| --- | --- |
| frontend | https://frontend-production-b1451.up.railway.app |
| backend | https://backend-production-7ae36.up.railway.app (health: `/health`) |

Each service is configured by the `railway.json` in its folder, and `.railwayignore`
keeps the upload to what runs.

## First-time setup

Already done for the current project; repeat only for a new one.

```sh
brew install railway
railway login
railway init --name meridian
railway add --service backend
railway add --service frontend
railway domain --service backend --port 8080
railway domain --service frontend --port 8080
```

In Supabase, add the frontend URL followed by `/**` under Authentication → URL
Configuration → Redirect URLs, or Google sign-in will not return to the app.

## Variables

From the repository root, with both `.env` files filled in:

```sh
scripts/deploy/railway-variables.sh backend-production-7ae36.up.railway.app frontend-production-b1451.up.railway.app
```

It prints only names. Re-run it after changing a key, then redeploy the service that
uses it. The frontend's `VITE_*` values are read at build time, so they take effect
only on its next deploy.

## Deploying

From the repository root, backend first:

```sh
railway up backend --path-as-root --service backend
railway up frontend --path-as-root --service frontend
```

Add `--detach` to return without following the build. Watch with
`railway logs --service backend` (add `--build` for build output).

Deploy from a clean, committed branch (normally `main`), so what runs matches the
repository.
