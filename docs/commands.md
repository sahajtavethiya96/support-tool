# Commands

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm db:local        # start local embedded postgres (dev only)
pnpm setup           # validate env, migrate, seed defaults
pnpm create:admin you@example.com "Your Name" "a-strong-password"
pnpm dev             # start Next.js + worker concurrently
```

Open `http://localhost:3000`.

`pnpm setup` is the guided bootstrap for everything except the admin account —
it runs `db:migrate` + `db:seed`. Safe to re-run.

Creating the first admin is a deliberate, separate step (`pnpm create:admin`)
rather than automatic — that way you get immediate success/failure feedback
right in your terminal, instead of it happening silently inside a detached
background process (e.g. Docker's `migrate` service) where a failure could
easily go unnoticed.

To create or promote an account:

```bash
# Create a brand-new admin with a password — signs in immediately, no SMTP needed
pnpm create:admin you@example.com "Your Name" "a-strong-password"

# Create a magic-link-only admin (no password — requires SMTP to sign in)
pnpm create:admin you@example.com "Your Name"

# Promote an account that already signed in via magic link / Google
pnpm make:admin you@example.com
```

---

## Development

```bash
pnpm dev             # Next.js (turbopack) + pg-boss worker (concurrently)
pnpm dev:next        # Next.js only
pnpm worker          # pg-boss worker only (watch mode)
pnpm typecheck       # TypeScript type check
pnpm lint            # biome lint check
pnpm lint:fix        # biome lint + auto-fix
pnpm format          # biome format
```

---

## Database

```bash
pnpm db:local        # start embedded postgres for local dev
pnpm db:generate     # generate migration from schema changes
pnpm db:migrate      # apply pending migrations
pnpm db:seed         # seed default ticket statuses & categories (idempotent)
pnpm db:push         # push schema directly (dev only — skips migration file)
pnpm db:reset        # drop all tables + re-migrate (destroys all data)
```

---

## Docker

Bundled Postgres (default):

```bash
docker compose up -d           # start app + worker + postgres
docker compose down            # stop all services
docker compose logs -f app     # tail app logs
docker compose logs -f worker  # tail worker logs
```

Your own external database instead — same commands, plus `-f docker-compose.external-db.yml`:

```bash
docker compose -f docker-compose.external-db.yml up -d
docker compose -f docker-compose.external-db.yml down
docker compose -f docker-compose.external-db.yml logs -f app
```

Build the worker image separately:

```bash
docker build -f Dockerfile.worker -t support-tool-worker .
```

---

## Migrating from Zammad

Two one-off, idempotent scripts (safe to re-run — already-migrated data is skipped,
never duplicated). Run `migrate:zammad:users` **first**, then `migrate:zammad` —
that order lets the ticket migration link each reply's author directly (by email)
as it writes it, instead of relying on a slower name-matching backfill afterward.
Each script's own header comment has the full details.

```bash
# 1) Agent/admin accounts — creates a Support Tool user (as a plain agent) for
#    every Zammad Agent/Admin, all sharing one default password.
#    See scripts/migrate-zammad-users.ts.
ZAMMAD_BASE_URL=... ZAMMAD_API_TOKEN=... pnpm migrate:zammad:users

# 2) Tickets, comments, attachments, tags — see scripts/migrate-zammad.ts.
#    Links each reply's author_id/uploaded_by_id to the user created in step 1
#    (matched by email) as it migrates.
ZAMMAD_BASE_URL=... ZAMMAD_API_TOKEN=... pnpm migrate:zammad
```

Ran it in the other order, or migrated tickets before any users existed? Re-run
`migrate:zammad:users` afterward — it always re-sweeps already-migrated
comments/attachments and connects any still-unlinked ones by matching author name,
so nothing is left behind.

Both accept `MIGRATION_DRY_RUN=1` to preview without writing. The user-migration
script's shared default password is `debutify@123456` unless overridden via
`MIGRATION_USER_PASSWORD` — tell the team to change it after first login.
