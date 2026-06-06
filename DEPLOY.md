# Deployment

Recommended stack: **Render** (API + Postgres), **Cloudflare R2** (audio
storage), **Resend** (email). The frontend can be served by Render's static
hosting (included in the blueprint) or Cloudflare Pages.

A `render.yaml` Blueprint is included that provisions the database, the API
(Docker) and the static SPA together.

---

## 1. Database + API (Render Blueprint)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo. It reads `render.yaml`
   and creates:
   - `retrosamples-db` — managed Postgres.
   - `retrosamples-api` — the NestJS API (built from `apps/backend/Dockerfile`).
     `DATABASE_URL` is wired automatically and `JWT_SECRET` is generated.
   - `retrosamples-web` — the static SPA.
3. The API container runs `prisma migrate deploy` on every start, so the schema
   is created/updated automatically. (Seed once manually if you want demo data —
   see below.)

### Secrets to set in the dashboard (`sync: false`)

On **retrosamples-api**:

| Variable | Value |
|---|---|
| `CORS_ORIGIN` | the SPA URL, e.g. `https://retrosamples-web.onrender.com` |
| `APP_URL` | same SPA URL (used in email links) |
| `STORAGE_BUCKET` / `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` / `STORAGE_PUBLIC_URL` | Cloudflare R2 (see below) |
| `RESEND_API_KEY` / `MAIL_FROM` | Resend (see below) |

On **retrosamples-web**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | the API URL, e.g. `https://retrosamples-api.onrender.com` |

> Because the SPA and API are on different domains, the API sets
> `COOKIE_SAMESITE=none` (already in the blueprint) so session cookies are sent
> cross-site over HTTPS. If you put both behind one domain (e.g. `app.site.com`
> and `api.site.com` under `site.com`), set `COOKIE_DOMAIN=.site.com` and you
> can use `COOKIE_SAMESITE=lax`.

## 2. Object storage — Cloudflare R2

1. Create an R2 bucket (e.g. `retrosamples`).
2. Create an R2 API token (Access Key ID + Secret).
3. Enable public access (R2 public bucket URL or a custom domain) and use that
   as `STORAGE_PUBLIC_URL`.
4. Set on the API:
   - `STORAGE_DRIVER=s3` (already in the blueprint)
   - `STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`
   - `STORAGE_REGION=auto`
   - `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
   - `STORAGE_PUBLIC_URL=https://<your-public-r2-domain>`

Any S3-compatible store works (AWS S3, MinIO) — just change the endpoint/keys.

## 3. Email — Resend

1. Create a Resend account, verify a sending domain, create an API key.
2. Set `RESEND_API_KEY` and `MAIL_FROM` (e.g. `Retrosamples <noreply@yourdomain>`).

Without these, verification/reset links are logged to the API console instead.

## 4. Seeding demo data (optional)

From a one-off shell on the API service (or locally against the prod DB):

```bash
pnpm --filter @retrosampled/backend db:seed
```

## Alternative: frontend on Cloudflare Pages

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @retrosampled/frontend build`
- Build output directory: `apps/frontend/dist`
- Environment variable: `VITE_API_URL=https://<your-api-host>`
- Add a SPA fallback (`/* -> /index.html`).

## Local production-like run

```bash
docker compose up -d                 # Postgres
docker build -f apps/backend/Dockerfile -t retrosamples-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://retro:retro@host.docker.internal:5432/retrosamples \
  -e JWT_SECRET=local-dev-secret-please-change \
  retrosamples-api
```
