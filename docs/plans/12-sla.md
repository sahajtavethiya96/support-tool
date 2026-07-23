# Plan: SLA tracking

Called out as explicitly out of scope in `docs/plans/06-ticket-priority.md`
("SLA/due-date tracking tied to priority — separate, larger feature"). This
documents the design that was built.

## Goal

Admins configure SLA policies (First Response / Next Response / Resolution
targets), globally and optionally scoped by priority and/or category. Agents
see, on both the ticket list and detail page: how long a ticket has been
open, whether it's waiting on the agent or the customer, and remaining/
overdue time against each target — color-coded green/yellow/red — with the
clock automatically pausing while waiting on the customer.

## Design decision: reuse `awaitingReply` as the pause/resume signal

`tickets.awaitingReply` already exists and is flipped in exactly the right
places (`lib/tickets/create-ticket.ts`, the comments/close/reopen routes):
`true` when the customer is waiting on the agent, `false` when the agent has
replied and the customer is up. This is precisely the "waiting for customer"
/ "waiting for agent" language in the feature request, so the SLA
pause/resume rides that existing signal rather than a parallel concept.

## Design decision: policy resolution is live, not snapshotted

A ticket's applicable SLA policy is resolved at read time from its current
`priority`/`category` against the live policy list (most-specific-wins: exact
scope > priority-only > category-only > the unscoped default) — see
`lib/sla-policies.ts`'s `resolveSlaPolicy()`. No `slaPolicyId` is stored on
the ticket.

Trade-off: editing a policy immediately re-targets every open ticket that
matches its scope — there's no "the policy in effect when this ticket was
created" snapshot. This was chosen for simplicity (no backfill/migration
question, no "reapply policy" affordance needed) and because it matches this
codebase's existing philosophy for status/category/priority (`statusMap`
lookups are always live against the current config, never snapshotted). If
retroactive-safety ever becomes a real complaint, the fix is additive: add a
nullable `sla_policy_id` to `tickets`, set once at creation, and fall back to
live resolution when it's null (old tickets, or tickets created before this
column existed).

## Schema

`db/schema/sla-policies.ts` — new table, mirrors the `ticket_priorities` /
`ticket_categories` admin-config shape (plain cuid2 id, no enums):

```ts
export const slaPolicies = pgTable("sla_policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priority: text("priority"),   // ticket_priorities.slug scope; null = any
  category: text("category"),   // ticket_categories.slug scope; null = any
  firstResponseMinutes: integer("first_response_minutes").notNull(),
  nextResponseMinutes: integer("next_response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

`db/schema/tickets.ts` — three new columns, all additive bookkeeping next to
the existing `awaitingReply`/`pendingReplies`:

```ts
waitingSince: timestamp("waiting_since", { withTimezone: true }),
firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
slaActiveSeconds: integer("sla_active_seconds").notNull().default(0),
```

- **`waitingSince`** — when the *current* wait state began; null once
  resolved. Only updated on an actual `awaitingReply` flip (not on every
  message), so a customer's second follow-up before the agent replies
  doesn't reset the response clock to their latest message. Doubles as the
  anchor for the live First/Next Response elapsed time and the point the
  Resolution clock last resumed from.
- **`firstRespondedAt`** — frozen once set (first non-internal agent/admin
  reply), so First Response keeps displaying correctly after the ticket
  moves on to Next Response tracking.
- **`slaActiveSeconds`** — the pause/resume accumulator for Resolution,
  incremented by the completed span's length every time the clock pauses.
  Stored in **seconds**, not milliseconds — a 32-bit int would overflow at
  ~24.8 days of accumulated ms, which a long-lived ticket could plausibly hit.

Migration (`db/migrations/0016_nifty_ink.sql`) hand-appends one backfill
statement: `first_responded_at` is populated for existing tickets from the
earliest non-internal agent/admin row in `ticket_comments`, so upgrading
installs don't show every open ticket as "never responded" on day one.
`waiting_since` is deliberately left null for pre-existing rows — the
calculation code falls back to `created_at` when it's null — and
`sla_active_seconds` defaults to 0 (pre-migration active time on already-open
tickets isn't reconstructed; tracking is accurate from the day this shipped
forward).

## Calculation engine — `lib/sla.ts`

Pure functions, no DB/React, used identically by the list query, the detail
page, and the client-side ticking badges:

- `resolveWaitState(ticket)` → `"waiting_for_agent" | "waiting_for_customer" | "resolved"`.
- `computeSlaSnapshot(ticket, policy, now)` → builds `firstResponse` /
  `nextResponse` / `resolution` metric snapshots (each `{ targetSeconds,
  elapsedSeconds, asOf, live, frozen? }`). First Response and Resolution are
  frozen (final met/breached verdict) once resolved; Next Response only
  exists once the first response has happened and the ticket is currently
  waiting on the agent.
- `getLiveElapsedSeconds(metric, nowMs)` / `getMetricStatus(metric, nowMs)` —
  re-derive the current elapsed time and `"met" | "on_track" | "warning" |
  "breached"` status. `WARNING_THRESHOLD = 0.8` (80% of target elapsed →
  yellow) is a single exported constant — the extension point for making it
  per-policy later.
- `computeSlaTransition(current, nextAwaitingReply, now, mode)` — the single
  place encoding the pause/resume rule. Every route that mutates
  `awaitingReply` merges this into its existing `.update(tickets).set({...})`:
  a `"reply"` no-ops if the state doesn't actually change, `"closing"` flushes
  the in-progress span and stops the clock, `"reopening"` always restarts it
  at `now` (Resolution's accumulator carries forward across reopens — it
  tracks total active time across the ticket's whole lifetime).
- `formatDuration(seconds)` → `"45m"`, `"2h 15m"`, `"1d 4h"`, `"3d"` — shared
  by the admin policy form and the ticking badges.

Wired into every existing `awaitingReply` mutation site: ticket creation,
the agent/customer comments route, the public API's comments route, and both
close/reopen routes (agent-facing and public-API).

## Display — `components/common/sla-badge.tsx`

Server computes one `SlaSnapshot` per ticket (cheap pure-JS math, no extra
queries) and ships it down as a prop; the client ticks the countdown forward
every 30s via `Date.now()` — hydration-safe the same way
`components/common/local-datetime.tsx` is (deterministic first paint using
the snapshot's own `asOf`, then an effect takes over).

- `<SlaWaitBadge>` — "Open for 3d 4h" + "Waiting for agent · 2h 15m" (or
  "Waiting for customer…" / "Resolved").
- `<SlaMetricBadge>` — one colored pill per metric, color from
  `getMetricStatus()` reusing `lib/tickets.ts`'s existing `COLOR_BADGE`
  palette (green/emerald → on track or met, amber → warning, red → breached).
- `pickMostUrgentMetric()` — picks the single worst-status metric among
  Next-or-First-Response and Resolution, for the ticket list's SLA column
  where space only allows one badge.

## Admin UI

`/admin/ticket-config` gained a fourth section, `SlaPoliciesManager`, modeled
directly on `PrioritiesManager` (same Add/Edit/Delete dialog shell): a
priority scope select, a category scope select (both "Any" + the live
config lists), three minute inputs, and an "is default" checkbox that's only
enabled when both scope selects are "Any" (only an unscoped policy can be the
global fallback). `app/api/admin/sla-policies/route.ts` +
`.../[id]/route.ts` mirror `app/api/admin/priorities/`'s structure: reject a
duplicate (priority, category) scope pair, unset the previous default when a
new one is marked, block deleting the current default.

`lib/seed-defaults.ts` seeds one unscoped default policy (First response
60m, Next response 240m, Resolution 24h) keyed by a fixed id so
`onConflictDoNothing()` treats repeated seed runs as idempotent, same as the
existing status/category/priority seeds.

## Task checklist

- [x] `db/schema/sla-policies.ts` — new table
- [x] `db/schema/tickets.ts` — `waitingSince` / `firstRespondedAt` /
      `slaActiveSeconds`
- [x] `pnpm db:generate` + hand-appended `first_responded_at` backfill +
      `pnpm db:migrate`
- [x] `lib/sla.ts` — calculation engine + transition helper
- [x] `lib/sla-policies.ts` — reads + policy resolution
- [x] Wired `computeSlaTransition()` into create-ticket, agent/customer
      comments, public-API comments, close/reopen (agent + public API)
- [x] `app/api/admin/sla-policies/` — CRUD routes
- [x] `/admin/ticket-config` — `SlaPoliciesManager` UI section
- [x] `lib/seed-defaults.ts` — default unscoped policy
- [x] `components/common/sla-badge.tsx` — ticking display components
- [x] Ticket list — `sla` customizable column
- [x] Ticket detail sidebar — SLA card (wait state + all three metrics)
- [x] Docs: this file, `database-schema.md`, `tickets.md`, `admin-portal.md`,
      `development-plan.md`

## Out of scope (future extension points)

- **Business hours / holidays** — the elapsed-time math lives in exactly one
  function (`computeSlaSnapshot`'s `secondsBetween` calls); swapping wall-clock
  duration for a business-hours-aware calendar is a change to that one
  function, not a redesign.
- **Multiple overlapping policies with tie-breaking beyond scope specificity**
  (e.g. two equally-specific policies) — `resolveSlaPolicy()` takes the first
  match per precedence tier; ties within a tier are prevented at the API
  layer (duplicate scope pairs are rejected), so this shouldn't arise.
- **Per-policy warning threshold** — currently one global `WARNING_THRESHOLD`
  constant; making it a column on `sla_policies` is a small, additive change.
- **Snapshotting the resolved policy per ticket** at creation time (see the
  "live resolution" trade-off above).
