# Plan: Manager reports

Requested as "Better reports on the Dashboard": tickets/response-time per
agent, counts by category/priority/tag, CSV export. Built as a new
admin-only area rather than added to the shared `/dashboard` — see the
decision rationale below.

## Goal

A manager (admin) can answer "who's busy and how fast are we?" from one
page: tickets per agent with average first-response and resolution time,
ticket counts by category/priority/tag, and a CSV download for each report.

## Design decision: new admin-only page, not an addition to `/dashboard`

`/dashboard` is deliberately identical for agents and admins today
(`docs/dashboard.md`): "My Tickets" is scoped to the viewer's own id for
everyone, and there is no cross-agent comparison anywhere. A per-agent
speed/volume comparison is a different kind of feature — it looks *at*
people, not just at tickets — and this codebase consistently gates that kind
of feature to admins (bulk assign, user management, ticket deletion, audit
log). There's no separate "manager" role, so admin is the natural fit.

Built as `/admin/reports`, reusing the existing `(admin)` route group and
`/api/admin/*` proxy gating (`proxy.ts` already redirects non-admins away
from both `/admin/*` pages and `/api/admin/*` routes — zero proxy changes
needed).

## Data availability — no schema changes needed

The SLA feature (`docs/plans/12-sla.md`) already added exactly the columns
this needs:
- `tickets.firstRespondedAt` — time-to-first-reply, frozen once set.
- `tickets.slaActiveSeconds` — accumulated agent-active seconds toward
  resolution, which already **excludes time spent waiting on the customer**
  (unlike a naive `closedAt - createdAt`), making it a materially better
  "resolution time" metric than what would otherwise be directly available.

## Scope decisions

- **Tickets per agent counts by *current* `assignedAgentId`** — not
  reassignment-weighted history. Matches how the rest of the app treats
  assignment (single current owner, e.g. the ticket list's `assignee`
  filter in `lib/tickets-list-query.ts`). An "Unassigned" row is included.
- **Date range** (`?range=30d|90d|all`, default `30d`) applies uniformly to
  every report and its CSV, filtered on `tickets.createdAt` — same shape as
  the dashboard's existing 7d/30d volume chart toggle, not a new
  date-picker system.
- **Tag report capped to the top 20** by ticket count (tags are an unbounded
  freeform pool, `db/schema/tags.ts`) — shown as "Top 20 tags by ticket
  count" rather than silently truncating.
- **CSV**: no CSV library existed in the repo (confirmed explicitly deferred
  in `docs/plans/00-overview.md`) — hand-rolled a ~20-line RFC-4180 quoting
  helper (`lib/csv.ts`) instead of adding a dependency. Download trigger is a
  plain `<a download href="...">`, the same pattern already used by
  `components/profile/export-data-card.tsx` / `app/api/account/export/route.ts`
  — no client JS, the browser handles it via `Content-Disposition`.
- CSV rows use raw numeric seconds for the time columns (not formatted
  "2h 15m" strings) — a CSV is for further spreadsheet analysis, where raw
  numbers are more useful than pre-formatted text. The on-page table uses
  `lib/sla.ts`'s existing `formatDuration()` for human-readable display.

## Implementation

- `lib/reports.ts` (new) — one query function per report
  (`getTicketsByAgentReport`, `getTicketsByCategoryReport`,
  `getTicketsByPriorityReport`, `getTicketsByTagReport`), each taking
  `range: "30d" | "90d" | "all"`. Used identically by the page (SSR) and the
  CSV routes — one engine, two consumers, same philosophy as `lib/sla.ts`.
- `lib/csv.ts` (new) — `toCsv(rows, columns)`.
- `app/api/admin/reports/{by-agent,by-category,by-priority,by-tag}/csv/route.ts`
  (new) — `requireAdminFromRequest` + the matching `lib/reports.ts` call +
  `toCsv()`, returned with `Content-Type: text/csv` and a `Content-Disposition:
  attachment` filename.
- `app/(admin)/admin/reports/page.tsx` (new) — range toggle (plain links,
  `?range=`) + the four report sections.
- `app/(admin)/admin/reports/_components/agent-report-table.tsx` (new) — the
  agent report's distinct 5-column shape.
- `app/(admin)/admin/reports/_components/breakdown-report-table.tsx` (new) —
  one reusable label/count/share table, used for category, priority, and tag
  (tag omits the share column — a ticket can have multiple tags, so tag
  shares don't sum to 100%).
- `components/agent/sidebar.tsx` — added `Reports` to `adminItems`
  (`ChartBarIcon`).

## Out of scope / future extension

- Per-agent SLA met/breached counts (vs. just raw average times) — would
  reuse `lib/sla.ts`'s existing `frozen: "met"|"breached"` logic per closed
  ticket, grouped by agent. Deferred since it wasn't asked for and adds a
  second axis to an already-dense table.
- Custom date ranges (not just 30d/90d/all) — the ticket list already has a
  `custom` range with `from`/`to` day bounds (`lib/tickets-list-query.ts`);
  reuse that shape if finer control is ever needed.
- Scheduled/emailed report exports — CSV is on-demand only for now.
