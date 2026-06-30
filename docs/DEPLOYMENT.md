# Deployment — AURA (Vercel frontend + Render backend)

AURA deploys as a **split**: the Next.js web app runs on **Vercel**, the Go API +
Postgres run on **Render**. The browser only ever talks to the Vercel origin; the
web app proxies `/api/v1/*` to the API, so auth cookies stay first‑party.

```
 Browser ──▶ https://auragh.vercel.app                (Vercel — Next.js)
                 │  Next rewrite  /api/v1/*  ──▶  API_ORIGIN
                 ▼
            https://aura-api.onrender.com             (Render — Go API)
                 │
                 ▼
            aura-postgres                              (Render — managed Postgres)
```

All secret values live in **`production.env`** (gitignored — never committed).
Copy from there into the Render / Vercel dashboards.

---

## Prerequisites

1. Code pushed to the GitHub repo Render & Vercel can read.
2. `production.env` filled in (secrets already generated; you've added the Resend
   key + Cloudinary creds).

---

## Part A — Backend on Render (do this first; you need the API URL for Vercel)

1. **New + → Blueprint**, pick the repo. Render reads [`render.yaml`](../render.yaml)
   and proposes `aura-postgres` (managed Postgres) and `aura-api` (Docker web
   service).
2. **Apply**. Then open **aura-api → Environment** and set the `sync: false`
   secrets from `production.env`:
   - `JWT_SIGNING_KEY`
   - `MFA_ENCRYPTION_KEY`
   - `MAIL_PASSWORD`  (your Resend API key, `re_…`)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   (`DATABASE_URL` is wired automatically; `CORS_ALLOWED_ORIGINS`, the Resend
   host/port/user, and `MAIL_FROM=onboarding@resend.dev` are already in the blueprint.)
3. **Deploy.** On boot the API **self‑migrates** (`AUTO_MIGRATE=true`, embedded
   goose migrations) and starts the folded‑in background sweep
   (booking‑expiry + idempotency cleanup) — no separate worker, no pre‑deploy step.
4. Confirm health: `https://<your-api>.onrender.com/healthz` → `200`.
5. **Copy the exact API URL** Render assigns (usually `https://aura-api.onrender.com`,
   sometimes with a random suffix). You'll need it for Vercel `API_ORIGIN`.

**Free‑tier caveats**
- The service **spins down when idle** → the first request after a lull cold‑starts
  (~30–60 s). The folded sweep only runs while the service is awake.
- Managed Postgres is configured on Render's smallest currently supported paid
  plan in the Blueprint. To stay on a temporary free database for demos, follow
  the note in `render.yaml` and wire `DATABASE_URL` manually.

### Publish clean demo data

The repo ships an **idempotent** demo seed ([`db/seed/seed.sql`](../db/seed/seed.sql)):
the real Ashesi buildings/rooms, departments, equipment, a DRAFT semester, and four
demo accounts (all share the password `Password123!` — **rotate for real production**).
The API can load it on boot when `SEED_DATA=true`.

1. In **aura-api → Environment**, set `SEED_DATA=true` (the blueprint default is
   `false`).
2. **Redeploy.** On boot the API migrates (`AUTO_MIGRATE`) **then** seeds — both
   idempotently, so re‑running is safe and inserts nothing already present.
3. **Confirm** the demo accounts work: sign in at the Vercel site with
   `admin@cbs.example.edu` / `Password123!` (other roles:
   `timetable@cbs.example.edu`, `officer@cbs.example.edu`, `lecturer@cbs.example.edu`),
   and check the public room directory lists the real rooms (e.g. Nutor Hall 100).
4. **Set `SEED_DATA` back to `false`** and redeploy (or just leave it until the next
   deploy). The seed is best‑effort — a seed error is logged but never crashes the
   API — but turning it off keeps boot lean and avoids re‑running it every deploy.

---

## Part B — Frontend on Vercel

1. **Add New… → Project**, import the repo.
2. **Root Directory → `apps/web`.** Vercel auto‑detects Next.js + the pnpm
   workspace (it installs from the repo root). Leave build/install on defaults.
3. **Environment Variables** (Production **and** Preview — they're read at build):
   | Key | Value |
   | --- | --- |
   | `API_ORIGIN` | the Render API URL from A.5, e.g. `https://aura-api.onrender.com` |
   | `NEXT_PUBLIC_SITE_URL` | `https://auragh.vercel.app` |
   | `NEXT_PUBLIC_APP_TZ` | `Africa/Accra` |
4. **Deploy.**

> `API_ORIGIN` is baked into the rewrite at build time, and `NEXT_PUBLIC_*` are
> inlined at build time — so **re‑deploy after changing them**.

---

## Part C — Wire the two together

- **CORS:** `CORS_ALLOWED_ORIGINS` on Render is already `https://auragh.vercel.app`.
  If your Vercel domain differs (or you add a custom domain), update it (comma‑separate
  multiple origins) and redeploy the API.
- **If the Render host isn't `aura-api.onrender.com`:** update `API_ORIGIN` in
  Vercel (and `production.env`) to the real host, then redeploy the web app.
- **Custom domain:** add it in Vercel, then set `NEXT_PUBLIC_SITE_URL` to it and
  add it to `CORS_ALLOWED_ORIGINS` on Render.

---

## Email (Resend)

Using Resend's shared sender `onboarding@resend.dev` needs **no domain verification**,
but Resend will only **deliver to your own account email** until you verify a domain.
To send to anyone: verify a domain at resend.com → set `MAIL_FROM` to an address on
it (e.g. `no-reply@your-domain`) on Render and in `production.env`.

---

## Verify after deploy

1. `https://auragh.vercel.app` loads; the public room directory renders.
2. `https://auragh.vercel.app/api/v1/public/rooms` returns JSON (proxy → API works).
3. Sign in → reach `/app`. Cookies are set on the Vercel origin (first‑party).
4. SEO: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/opengraph-image`,
   `/twitter-image` all resolve. Paste the URL into a Twitter/WhatsApp/Slack chat
   to confirm the link preview card renders.
