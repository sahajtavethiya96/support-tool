# Next Iteration — Planning Overview

This directory plans the next batch of work on top of the completed MVP
(`docs/development-plan.md`, phases 1–10, all complete). Support Tool remains
**open-source and self-hosted** — a single team's own instance, not a
multi-tenant SaaS. Every plan here is scoped with that in mind: no
multi-tenancy, no billing/usage metering, no cross-org analytics.

Read the full audit context in this conversation for how each gap was found.
Below is the decision made per item and where its plan lives.

---

## Decisions

| # | Feature | Decision | Plan |
|---|---------|----------|------|
| 1 | "My Tickets" list email | **Verify & complete** — code inspection shows it is still a stub (see note below) | [01-my-tickets-email.md](./01-my-tickets-email.md) |
| 2 | Rate limiting on public routes | **Build** | [02-rate-limiting.md](./02-rate-limiting.md) |
| 3 | Dead `GET /api/tickets` stub | **Deleted** — done, see below | — |
| 4 | Bulk actions (agent portal) | **Build** | [03-bulk-actions.md](./03-bulk-actions.md) |
| 5 | Attachment deletion | **Build** | [04-attachment-deletion.md](./04-attachment-deletion.md) |
| 6 | Inbound email → ticket | **Skip** (not planned) | — |
| 7 | Canned / saved replies | **Build** | [05-canned-responses.md](./05-canned-responses.md) |
| 8 | Ticket priority | **Build** | [06-ticket-priority.md](./06-ticket-priority.md) |
| 9 | Audit-log / activity viewer | **Build** | [07-audit-log-viewer.md](./07-audit-log-viewer.md) |
| 10 | CSAT + CSV export | **Split** — CSAT still deferred, no plan yet. CSV export was built as part of the manager reports feature (item 17) — a raw per-ticket CSV export of the ticket list itself is not built | — |
| 11 | `/api/health` endpoint | **Deferred** — revisit later, no plan yet | — |
| 12 | Email/password login + per-method sign-in toggles | **Built** — see `docs/authentication.md` § 2 | — |
| 13 | Password reset (self-service + admin-initiated) | **Built** (self-service; also reused to fix the admin-invite flow, which previously created accounts with no way to sign in) — admin-initiated reset for an already-existing user is still deferred, see `docs/authentication.md` § 2 | [08-password-reset.md](./08-password-reset.md) |
| 14 | Open-source readiness (LICENSE, `package.json` metadata, CI, templates) | **Deferred** — prioritized functionality first | [09-open-source-readiness.md](./09-open-source-readiness.md) |
| 15 | Real-time ticket list + live ticket detail updates | **Build** — Pusher Channels, no polling fallback (explicit decision) | [10-realtime-updates.md](./10-realtime-updates.md) |
| 16 | Public API (`/api/v1`) | **Build** | [11-public-api.md](./11-public-api.md) |
| 17 | SLA tracking (First/Next Response, Resolution) | **Build** — policies scoped by priority/category, live pause/resume on `awaitingReply` | [12-sla.md](./12-sla.md) |
| 18 | Manager reports (tickets/response-time per agent, category/priority/tag breakdowns, CSV export) | **Build** — admin-only `/admin/reports`, reuses the SLA columns for response/resolution time | [13-reports.md](./13-reports.md) |

### A note on #1 — "already implemented"?

Re-checked `app/api/tickets/mine/send/route.ts` before writing this plan. It
still only does:

```ts
// TODO: enqueue email job containing the single "My Tickets" list link.
console.log(`[my-tickets] list link for ${email} → ${listUrl}`);
```

No `enqueueEmail()` call, no template. In dev, the link prints to the
**server terminal**, which is likely what looked like "it works" when
testing locally with the terminal open — but a real customer never receives
anything. [01-my-tickets-email.md](./01-my-tickets-email.md) plans the fix.

### #3 — dead route removed

`GET /api/tickets` was a stub (`return NextResponse.json({ tickets: [] })`
with a TODO) and had zero callers — the agent tickets list page queries the
database directly. Removed the handler and its now-unused `auth` import from
`app/api/tickets/route.ts`. `POST /api/tickets` (ticket submission) is
untouched.

---

## Suggested build order

1. **[My Tickets email](./01-my-tickets-email.md)** — smallest, closes a
   silently-broken documented feature.
2. **[Rate limiting](./02-rate-limiting.md)** — security; every other public
   surface benefits once this lands (shared middleware).
3. **[Attachment deletion](./04-attachment-deletion.md)** — small, already
   fully spec'd in `docs/file-uploads.md`, no schema change.
4. **[Ticket priority](./06-ticket-priority.md)** — schema + UI touch many
   files but the pattern mirrors existing status/category work exactly.
5. **[Bulk actions](./03-bulk-actions.md)** — depends on nothing above but
   benefits from priority existing (bulk-set-priority is a natural add-on).
6. **[Canned responses](./05-canned-responses.md)** — self-contained new
   feature area.
7. **[Audit-log viewer](./07-audit-log-viewer.md)** — pure read UI over data
   that already exists; do last since it's the least urgent.

Each plan doc is written to be actionable on its own — schema first, then
API, then UI, then edge cases — so they can be picked up independently in
any order if priorities change.

---

## Conventions every plan below follows (already established in this repo)

- IDs: `createId()` from `@paralleldrive/cuid2` — never `crypto.randomUUID()`.
- Every table has `createdAt` + `updatedAt` (`timestamp({ withTimezone: true })`).
- API routes return `{ error: string }` on failure with the correct HTTP status.
- Agent/admin routes check the session first → `401` if missing, `403` if
  wrong role. Customer routes verify the ticket's `customerToken`.
- Mutations that matter get **both**: a `ticketActivity` row (ticket-scoped,
  shown in the sidebar timeline) and/or an `audit()` call (system-wide,
  admin-only visibility) — see each plan for which applies.
- Admin-configurable lists (statuses, categories) follow the
  `slug / label / color / sortOrder` shape in `db/schema/ticket-config.ts` —
  priority follows the same shape.
- Dropdowns use the shared `SearchableSelect`
  (`components/common/searchable-select.tsx`), not the raw shadcn `Select`.
- Cards use `bg-card rounded-xl border border-border shadow-soft`; tables
  match the existing All Tickets / Users table markup.
- Migrations: edit schema → `pnpm db:generate` → review the generated SQL →
  `pnpm db:migrate`.
