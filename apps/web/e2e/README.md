# Web E2E

Playwright runs AURA through real browsers against the Next.js app.

## First Time Setup

```bash
pnpm e2e:install
```

## Local Run

```bash
pnpm e2e
```

By default, Playwright builds the web app, starts `next start` on
`http://127.0.0.1:3100`, and uses `API_ORIGIN=http://127.0.0.1:8080`.
Use `pnpm e2e:smoke` for the faster Chromium-only slice.

The default web-server startup timeout is 7 minutes because the production
build can take a few minutes on local machines. Override it when needed:

```bash
E2E_WEB_SERVER_TIMEOUT=600000 pnpm e2e
```

To point at an already-running web server:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 pnpm e2e
```

To run against `next dev` during local iteration:

```bash
E2E_WEB_SERVER_COMMAND='pnpm exec next dev --turbopack --hostname 127.0.0.1 --port 3100' pnpm e2e
```

## Full Login Flow

The default suite avoids committed credentials. To run the real login test,
start the API and provide a seeded account:

```bash
make localdb
make run-api
E2E_USER_EMAIL=aura.lecturer@ashesi.edu.gh \
E2E_USER_PASSWORD='your-local-seed-password' \
pnpm e2e
```

Use `credentials.txt` locally if you have it. Do not commit real passwords.
