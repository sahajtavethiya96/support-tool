# Plan: Audit log viewer

Not previously documented. `audit_logs` is already written to throughout
the app (`lib/audit.ts`'s `audit()` helper) — but there is **no screen** to
read it. For a self-hosted admin, "who did what and when" is exactly the
kind of thing they reach for after something unexpected happens (a user
banned, a session revoked, an account deleted) — right now that data is
invisible without a raw SQL query.

Confirmed currently-logged action types (from `audit()` call sites): `
auth.logout`, `auth.magic_link_sent`, `orbit.user_role_updated`,
`profile.name_updated`, `profile.email_updated`, `profile.session_revoked`,
`profile.other_sessions_revoked`, `profile.account_deleted`,
`profile.data_exported`, `user.created`.

(Note: ticket lifecycle events — status changes, replies, assignment — are
a **separate** table, `ticket_activity`, already visible in the ticket
detail sidebar. This plan is only for the system/account-level
`audit_logs` table, which has no viewer at all today.)

## Goal

A new admin-only page lists all audit log entries, newest first, with
search/filter, matching the look of the existing Users table.

## Where it lives

`app/(admin)/admin/audit-log/page.tsx` — under our own `/admin` route
group (`requireAdmin()`), **not** `/orbit` (Orbit is Better Auth's own
platform panel, a separate framework-provided surface per `CLAUDE.md` — this
is our app's data, so it belongs alongside Users/Appearance/Ticket Config).
Add a sidebar nav item in `components/agent/sidebar.tsx`'s `adminItems`
list.

## Data layer

No schema change — `audit_logs` already has everything needed
(`actorEmail`, `action`, `entityType`, `entityId`, `description`,
`metadata`, `createdAt`), plus indexes on `(actorId, createdAt)`,
`(entityType, entityId)`, and `createdAt` already exist
(`db/schema/audit-logs.ts`) — this table was built anticipating a viewer.

## API / page

Follow the exact pattern already built this session for `/admin/users` and
`/tickets` (Suspense + skeleton on search):

- `app/(admin)/admin/audit-log/page.tsx` — server component, `requireAdmin()`,
  renders filter controls + `<Suspense key={JSON.stringify(params)}
  fallback={<AuditLogTableSkeleton />}>`.
- Query params: `q` (searches `description` + `actorEmail` via `ilike`),
  `action` (exact match, populated from a `SearchableSelect` whose options
  are `SELECT DISTINCT action FROM audit_logs` — or simpler, a hardcoded
  list of the known actions above plus "All Actions"), `entityType`
  (optional second filter, same idea), `page`.
- Paginated the same way as Users (`PAGE_SIZE = 25`, `limit`/`offset`,
  Previous/Next).
- No API route needed — page queries the DB directly, matching how
  `/tickets` and `/admin/users` already work (no dead `GET` endpoints this
  time — see the note in `00-overview.md` about why the old `GET
  /api/tickets` stub was removed).

## UI

Table columns: **When** (relative + absolute on hover, reuse
`formatTicketDateTime`-style helper), **Actor** (email, or "System" if
`actorEmail` is null), **Action** (a small colored badge — reuse
`COLOR_BADGE`, mapping action prefixes to colors: `auth.*` → blue,
`profile.*` → slate, `orbit.*` → purple, `user.*` → green, fallback slate),
**Description** (the human-readable string already stored — this is the
main content, no need to re-derive anything from `metadata`),
**Entity** (small muted text: `entityType` + `entityId` truncated, useful
for cross-referencing "this was about ticket #1042" even though ticket
events aren't logged here today — future-proofs the column if that ever
changes).

Clicking a row (or a small expand chevron) reveals the raw `metadata` JSON
in a collapsible `<pre>` block — useful for debugging without needing a
dedicated column per possible metadata shape.

## Task checklist

- [ ] `app/(admin)/admin/audit-log/page.tsx` + `loading.tsx` (skeleton,
      same shape as `admin/users/loading.tsx`)
- [ ] Sidebar nav item under Admin section
- [ ] Search + action-type filter (`SearchableSelect`)
- [ ] Table with expandable metadata row
- [ ] Pagination
- [ ] Manual test: trigger a few of the logged actions (log out, update
      your name in profile settings, invite a user), confirm they all show
      up correctly with accurate descriptions and metadata

## Out of scope

- Exporting the audit log to CSV (could pair with the deferred CSV-export
  item from `00-overview.md` later).
- Retention/pruning policy for `audit_logs` (currently grows unbounded —
  worth a follow-up prune job similar to the one planned for
  `rate_limit_hits` in [02-rate-limiting.md](./02-rate-limiting.md), but
  not blocking the viewer itself).
- Surfacing `ticket_activity` in this same screen — that data already has
  its own home in the ticket detail sidebar and is per-ticket, not
  system-wide.
