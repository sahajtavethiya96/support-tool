# Deployment & Zammad Migration Guide

This is a step-by-step runbook for standing up Support Tool on a server with
Docker, and pulling historical tickets/attachments over from an existing
Zammad instance. Follow it in order — migration must happen **after** the
app is deployed and running.

---

## 1. Prerequisites

- A server (VPS or similar) with **Docker** and **Docker Compose** installed.
- This repo cloned onto that server.
- Access to the Zammad instance you're migrating from:
  - Its base URL (e.g. `https://support.oldcompany.com`)
  - An **API token** for a Zammad admin account (Zammad → Profile → Token
    Access → create a token with read access to Users, Tickets, Groups)

No local Node/pnpm install is required for the Docker path — everything
builds and runs inside containers.

---

## 2. Choose your Postgres setup

- **Bundled Postgres (default, easiest)** — `docker-compose.yml` runs
  Postgres + app + worker together, with data in a Docker volume.
- **Your own external database** (Neon, Supabase, RDS, etc.) —
  `docker-compose.external-db.yml` runs only app + worker; you supply
  `DATABASE_URL`.

Use ONE of these two compose files, not both. Everything below shows
Option A (bundled); if you're on Option B, add
`-f docker-compose.external-db.yml` to every `docker compose` command.

---

## 3. Configure environment variables

```bash
cp .env.docker.example .env
```

Edit `.env` and set at minimum:

| Variable | Required | Notes |
|---|---|---|
| `APP_SECRET` | Yes | Random string, **32+ characters**. Generate with `openssl rand -hex 32`. |
| `NEXT_PUBLIC_APP_URL` | Yes | The public URL this instance will be reached at, e.g. `https://support.yourco.com`. No trailing slash. |
| `DATABASE_URL` | Only for Option B | Already pre-filled to match the bundled Postgres for Option A — leave as-is. |

Optional but recommended:

| Variable | Purpose |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Without these, outgoing email (ticket notifications, magic links) is only logged, never actually sent. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enables "Continue with Google" login for agents. |

Storage defaults to local disk (`./uploads`, mounted as a persistent Docker
volume already in `docker-compose.yml` — no action needed). If you'd rather
use S3 or Cloudflare R2, see `docs/file-uploads.md`.

---

## 4. Build and start the stack

```bash
docker compose up -d
```

This builds the app image, starts Postgres, runs the one-shot `migrate`
service (DB migrations + default statuses/categories), then starts the
`app` and `worker` containers.

Check everything is healthy:

```bash
docker compose ps
docker compose logs -f app worker
```

The app is now listening on `:3000` inside the container (`expose`, not
`ports` — put a reverse proxy in front, see step 6).

---

## 5. Create the first admin account

Deliberately a manual step (not automatic on startup) so you see
success/failure immediately instead of it failing silently in a background
container:

```bash
docker compose run --rm app pnpm create:admin you@example.com "Your Name" "a-strong-password"
```

Sign in at `https://<your-domain>/login`.

---

## 6. Put a reverse proxy in front (TLS)

The `app` container only `expose`s port 3000 (not published to the host).
Put Nginx or Caddy in front for TLS termination and proxy to `:3000`, then
point `NEXT_PUBLIC_APP_URL` in `.env` at the final public HTTPS URL.

If you change `NEXT_PUBLIC_APP_URL` or any `NEXT_PUBLIC_PUSHER_*` var after
the first build, you must rebuild (not just restart) for it to take effect:

```bash
docker compose build && docker compose up -d
```

---

## 7. Migrate data from Zammad

Once the app is deployed and reachable, migrate historical tickets. Both
scripts are **read-only against Zammad** — they only issue `GET` requests
(verified: no POST/PUT/PATCH/DELETE anywhere in either script). Nothing in
Zammad is ever modified or deleted; the scripts only copy data out into
Support Tool's own database and file storage.

Both scripts are **idempotent** — safe to re-run. Already-migrated tickets
/ users are skipped, never duplicated.

### 7.1 Dry run first

Always preview before writing anything:

```bash
docker compose exec \
  -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
  -e ZAMMAD_API_TOKEN="your-admin-api-token" \
  -e MIGRATION_DRY_RUN=1 \
  app pnpm migrate:zammad:users

docker compose exec \
  -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
  -e ZAMMAD_API_TOKEN="your-admin-api-token" \
  -e MIGRATION_DRY_RUN=1 \
  app pnpm migrate:zammad
```

Review the logged counts (tickets, comments, attachments, tags) before
proceeding.

### 7.2 Migrate agent/admin accounts (run FIRST)

```bash
docker compose exec \
  -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
  -e ZAMMAD_API_TOKEN="your-admin-api-token" \
  app pnpm migrate:zammad:users
```

Creates a Support Tool user (as a plain agent, regardless of their Zammad
role) for every Zammad Agent/Admin, matched by email. **Every created
account shares one default password**: `debutify@123456`, unless you
override it with `-e MIGRATION_USER_PASSWORD="..."`. This script does not
email anyone or force a reset — **tell the team to change their password
after first login**. Promote specific people to admin afterward:

```bash
docker compose exec app pnpm make:admin someone@yourco.com
```

### 7.3 Migrate tickets, comments, attachments, tags

```bash
docker compose exec \
  -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
  -e ZAMMAD_API_TOKEN="your-admin-api-token" \
  app pnpm migrate:zammad
```

Preserves: subject, opening message, full conversation thread, attachments
(bytes copied), customer name/email, original timestamps, open/closed
status, priority, internal-note flags, awaiting-reply state, and tags.
Does **not** preserve Zammad's original ticket number (Support Tool assigns
its own; the original is recorded in a `zammad_migrated` activity row).

Useful optional flags (pass as `-e` before `app`, same as above):

| Env var | Purpose |
|---|---|
| `MIGRATION_ZAMMAD_SEARCH` | Restrict export to a Zammad search query, e.g. `tags:DTM`. Omit to migrate ALL tickets. |
| `MIGRATION_LIMIT` | Stop after seeing N tickets (oldest-first) — useful for a first test batch, e.g. `100`. |
| `MIGRATION_DEFAULT_CATEGORY` | Category slug assigned to imported tickets (default `issue`). |

**Attachments — important caveat:** unlike the app's normal upload path
(which restricts uploads to JPG/PNG/PDF/ZIP/TXT, 10 MB max, 5 files per
ticket), this migration copies through **every attachment type and size
exactly as it was in Zammad** — images, zips, Word docs, anything — with no
filtering or per-ticket cap. That's intentional (preserve full history),
but be aware disk usage may be larger than the app's normal rules would
otherwise allow.

If it crashes partway through, just re-run the same command — a checkpoint
file (`uploads/.zammad-migration-state.json`) and a DB marker on each
migrated ticket make it resume without duplicating anything. If some
tickets fail, only those are retried on the next run (see the summary
printed at the end for a failed count and pointer to the checkpoint file).

### 7.4 Order matters, but there's a safety net

Run `migrate:zammad:users` **before** `migrate:zammad` — replies then link
directly to the right agent account as they're written. If you ran them out
of order (or migrated tickets before any users existed), just re-run
`migrate:zammad:users` afterward — it always re-sweeps already-migrated
comments/attachments and links any still-unlinked ones by matching author
name.

---

## 8. Post-migration checklist

- [ ] Spot-check a handful of migrated tickets in the UI — conversation
      order, internal notes still marked internal, attachments open
      correctly.
- [ ] Confirm migrated agent accounts can log in and have been told to
      change their shared default password.
- [ ] Promote the right people to admin with `pnpm make:admin`.
- [ ] Confirm SMTP is configured if you want live email notifications
      going forward (not just logged).
