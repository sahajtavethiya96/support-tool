# Support Tool

An open-source, self-hosted customer support ticketing system. Deploy it on your own infrastructure and handle customer support tickets without giving your data to a third party.

Built with Next.js, PostgreSQL, Drizzle ORM, and Better Auth.

---

## Features

- **Customer Portal** — Customers submit tickets with no account required. They receive a secure email link to view and reply to their tickets.
- **Agent Portal** — Support agents view, assign, filter, and respond to all tickets. Internal notes are hidden from customers.
- **Admin Portal** — Admins manage users, assign roles, and delete spam tickets.
- **Email Notifications** — Customers are notified when their ticket is created, when an agent replies, and when it is closed.
- **File Attachments** — JPG, PNG, PDF, ZIP, TXT up to 10 MB, max 5 per ticket.
- **Dashboard** — Ticket stats for agents and admins (open, in-progress, closed, average wait time).
- **Activity History** — Full audit trail per ticket (status changes, assignments, replies).
- **Role-Based Access** — Customer, Agent, and Admin roles with strict permission enforcement.
- **Public API** — Create tickets from your own website via API-key-authenticated REST endpoints. See [docs/api.md](docs/api.md).

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Better Auth (Email & Password + Magic Link + Google OAuth) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Email | Nodemailer (SMTP) |
| Jobs | pg-boss |
| File Storage | Local filesystem (dev) / S3-compatible (prod) |

---

## Quick Start

> The fastest way to run a production instance is [Docker](#docker-self-hosted).
> The steps below are for local development without Docker.

### Prerequisites

- Node.js 22+
- pnpm 11+
- PostgreSQL 16+ — or use the bundled embedded Postgres (`pnpm db:local`)

### Setup

```bash
git clone https://github.com/your-org/support-tool
cd support-tool
pnpm install
cp .env.example .env
```

Edit `.env` — set `APP_SECRET` (32+ characters) and `NEXT_PUBLIC_APP_URL`. SMTP is optional
(without it, outgoing emails are logged to the worker console instead of delivered).

`DATABASE_URL` is also required, but `.env.example`'s default already points at
`localhost:54329` — matching the embedded Postgres `pnpm db:local` starts below — so leave
it as-is if you're using that. Only change it if you're pointing at your own PostgreSQL
instance instead.

```bash
pnpm db:local                 # optional: start an embedded Postgres on :54329
pnpm setup                    # run migrations + seed default statuses/categories
pnpm create:admin you@example.com "Your Name" "a-strong-password"
pnpm dev                      # runs Next.js + the background worker together
```

The password lets you sign in immediately with no SMTP configured. Omit it
to create a magic-link-only admin instead (see the tip below for how that
still works in dev without SMTP).

Open `http://localhost:3000`.

> **Tip:** during development every outgoing email's links are printed to the worker
> console, so you can click magic-link / ticket links without configuring SMTP.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_SECRET` | Yes | Random secret for signing sessions (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your deployment (e.g. `https://support.yourco.com`) |
| `SMTP_HOST` | No | SMTP server hostname (omit to log emails instead of sending) |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `EMAIL_FROM` | No | From address for outgoing email |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID — enables "Continue with Google" |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `EMAIL_WEBHOOK_SECRET` | No | Shared secret for SMTP provider delivery webhooks |
| `NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID` | No | Pusher Beams instance id — enables browser/OS push for agents (baked in at build time) |
| `PUSHER_BEAMS_SECRET_KEY` | No | Pusher Beams secret key (server only) |
| `PUSHER_APP_ID` | No | Pusher Channels app id — enables real-time ticket list + live ticket detail updates (server only) |
| `NEXT_PUBLIC_PUSHER_KEY` | No | Pusher Channels app key (baked in at build time) |
| `PUSHER_SECRET` | No | Pusher Channels secret (server only) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | No | Pusher Channels cluster, e.g. `us2`, `eu` (baked in at build time) |

> **Agent notifications:** customer replies notify agents **in-app** via the notification
> bell (no config needed). Configure the two `*_PUSHER_BEAMS_*` vars to also send OS-level
> push that works when the app is closed. See [docs/in-app-notifications.md](docs/in-app-notifications.md).
>
> **Real-time updates:** configure the four `PUSHER_*`/`NEXT_PUBLIC_PUSHER_*` Channels
> vars above (a *different* Pusher product from Beams — create a separate "Channels" app
> in the same dashboard) to make the agent ticket list and an open ticket detail page
> update live, with no manual refresh. Without them, both pages work exactly as before.
> See [docs/realtime-updates.md](docs/realtime-updates.md).

---

## Docker (Self-Hosted)

Two ways to run this, depending on whether you want Postgres bundled or you already
have your own hosted database (Neon, Supabase, RDS, etc.):

### Option A — Bundled Postgres (default, zero-config)

`docker-compose.yml` runs the full stack: PostgreSQL, the Next.js app, and the pg-boss
background worker.

```bash
cp .env.docker.example .env
# Set APP_SECRET (32+ chars) and NEXT_PUBLIC_APP_URL. DATABASE_URL is already
# pre-filled to match the bundled Postgres below — no edit needed.
docker compose up -d
```

### Option B — Your own external database

`docker-compose.external-db.yml` runs the same app + worker but with **no** bundled
Postgres service at all — use this file *instead of* `docker-compose.yml`, not
alongside it:

```bash
cp .env.docker.example .env
# Replace DATABASE_URL with your own connection string.
docker compose -f docker-compose.external-db.yml up -d
```

Every `docker compose` command below (`logs`, `down`, `run`, etc.) needs the same
`-f docker-compose.external-db.yml` flag if you're using Option B.

---

On startup a one-shot `migrate` service runs database migrations and seeds the default
statuses & categories before the app and worker start (against whichever database you
configured above). The app is served on **http://localhost:3000**. Uploaded attachments
persist in the `uploads` volume.

```bash
docker compose logs -f app worker     # follow logs
docker compose down                   # stop (data persists in volumes)
```

Then create your first admin — this is a deliberate, explicit step (not automatic on
startup) so you get immediate success/failure feedback right in your terminal, instead
of a failure silently happening inside a detached background service:

```bash
docker compose run --rm app pnpm create:admin you@example.com "Your Name" "a-strong-password"
```

Sign in at `/login` with that email and password. Omit the password argument to create a
magic-link-only admin instead (requires SMTP to be configured to sign in).

**Enabling Pusher Beams (OS push) with Docker:** the instance id is baked into the
client bundle at build time, so pass it as a build arg, then set the secret at runtime:

```bash
docker compose build --build-arg NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID=your-instance-id
# put PUSHER_BEAMS_SECRET_KEY in .env, then:
docker compose up -d
```

**Enabling Pusher Channels (real-time updates) with Docker:** same idea, different
build args — the key and cluster are also baked in at build time:

```bash
docker compose build --build-arg NEXT_PUBLIC_PUSHER_KEY=your-key --build-arg NEXT_PUBLIC_PUSHER_CLUSTER=us2
# put PUSHER_APP_ID and PUSHER_SECRET in .env, then:
docker compose up -d
```

---

## Deployment

### Railway / Render / Fly.io

1. Fork this repo.
2. Create a new project pointing at your fork.
3. Set all required environment variables.
4. Add a PostgreSQL add-on.
5. Deploy.

### VPS (manual)

1. Install Node.js 22, PostgreSQL 16, and pnpm.
2. Clone the repo, `pnpm install`, and set up `.env`.
3. Build and initialise:
   ```bash
   pnpm build
   pnpm setup            # migrations + seed
   pnpm create:admin you@example.com "Your Name" "a-strong-password"
   ```
4. Run **two** long-lived processes (e.g. with systemd, PM2, or `screen`):
   ```bash
   pnpm start            # Next.js app on :3000
   pnpm worker:start     # pg-boss background worker (emails, jobs)
   ```
5. Put Nginx (or Caddy) in front for TLS and proxy to `:3000`.

---

## Roles

| Role | How to get it |
|------|---------------|
| Customer | No account needed — submits tickets via the public portal |
| Agent | Admin assigns it via the admin panel |
| Admin | Via `pnpm make:admin email@...` or promoted in admin panel |

---

## Contributing

Contributions are welcome. Please open an issue before submitting a large PR.

---

## License

MIT
