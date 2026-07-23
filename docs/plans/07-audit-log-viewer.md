# Plan: Audit log viewer

Not previously documented. `audit_logs` is already written to throughout
the app (`lib/audit.ts`'s `audit()` helper) — but there is **no screen** to
read it. For a self-hosted admin, "who did what and when" is exactly the
kind of thing they reach for after something unexpected happens (a user
banned, a session revoked, an account deleted) — right now that data is
invisible without a raw SQL query.

Confirmed currently-logged action types at the time this plan was written
(from `audit()` call sites): `auth.logout`, `auth.magic_link_sent`,
`orbit.user_role_updated`, `profile.name_updated`, `profile.email_updated`,
`profile.session_revoked`, `profile.other_sessions_revoked`,
`profile.account_deleted`, `profile.data_exported`, `user.created`. Coverage
was significantly expanded later — see "Addendum: closing the coverage gaps"
below for the current, much larger set. The filter's dropdown no longer
tracks a hardcoded list at all (see the addendum) — this list is frozen here
as a historical snapshot, not something to keep updating.

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

---

## Addendum: closing the coverage gaps

The viewer itself worked correctly from day one — the "All Actions" filter's
WHERE-clause wiring (`eq(auditLogs.action, action)`) was never broken. Two
real problems surfaced once the app grew past the original 10 action types:

1. **Sparse coverage.** Most admin mutations never called `audit()` at all —
   role changes and bans/deletes via the main `/admin/users` UI, every
   ticket-config CRUD route (statuses/categories/priorities/SLA
   policies/custom fields), email templates, platform/appearance settings,
   API key create/revoke, and single-ticket deletion. Only the Better Auth
   Orbit-panel actions (`orbit.*`) and ticket bulk actions were audited on
   the main paths admins actually use day-to-day.
2. **A self-defeating dropdown.** The filter's option list
   (`audit-log-actions.ts`'s `AUDIT_ACTIONS`) was a hand-maintained array
   with its own comment warning "update this whenever a new `audit()` call
   site is added" — nobody did, so newly-added action types (e.g.
   `user.password_set_by_admin`, `orbit.user_banned`) existed in the data
   but couldn't be selected from the dropdown.

**Fix for #2 — made structural, not just patched:** `page.tsx` now runs
`SELECT DISTINCT action FROM audit_logs` and passes the live result to
`AuditLogFilters` as its `actions` prop, instead of importing the static
list. `AUDIT_ACTIONS` still exists, but purely as a label lookup
(`getAuditActionLabel`) for pretty display — an action with no entry there
just shows its raw slug, which was already the fallback behavior. The
dropdown can now never drift out of sync with reality again, by
construction.

**Fix for #1 — filled in every gap**, following the existing dot-namespaced
`{subsystem}.{verb}_{noun}` convention:

| Area | Actions added |
|---|---|
| Users (main admin UI) | `user.role_updated`, `user.banned`, `user.unbanned`, `user.deleted` |
| Tickets | `ticket.deleted` (single-ticket; bulk delete/update were already covered) |
| Ticket config | `ticket_config.status_created/updated/deleted`, `ticket_config.category_created/updated/deleted`, `ticket_config.priority_created/updated/deleted` |
| SLA policies | `sla_policy.created/updated/deleted` |
| Custom fields | `custom_field.created/updated/deleted` |
| Email templates | `email_template.updated` |
| Platform settings | `settings.updated` (theme, appearance mode, brand, and — notably — the password/magic-link/Google sign-in toggles) |
| API keys | `api_key.created`, `api_key.revoked` |

`actionBadgeClass` (`audit-log-table.tsx`) got two new color buckets: an
orange bucket for all the config-change prefixes above (`ticket_config.*`,
`sla_policy.*`, `custom_field.*`, `email_template.*`, `settings.*`) and a red
bucket for `api_key.*` (creating/revoking API access is the most
security-sensitive action category in the app).

Deliberately **not** logged: read-only routes, and PATCH-only field renames
that don't change access or configuration (e.g. renaming an API key's label
without touching its scope) — the bar is "did this change something another
admin would need to know about," not every field-level write.
