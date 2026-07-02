# Plan: Ticket priority

Not previously documented. You have status (workflow stage) and category
(type of issue) but nothing captures *urgency* — the thing agents actually
use to decide what to work on next.

## Goal

Every ticket has a priority (Low / Normal / High / Urgent by default); it's
visible as a badge in the list and ticket detail, settable by agents, and
filterable/sortable like status/category.

## Design decision: admin-configurable, mirroring statuses/categories

This app's stated principle (`docs/development-plan.md`, "Beyond the
original plan"): *"no code hardcodes status slugs"* — statuses and
categories are fully admin-managed at `/admin/ticket-config`
(`db/schema/ticket-config.ts`: `slug / label / color / sortOrder`, plus
`isDefault` for statuses). Priority should follow the exact same pattern
rather than being a hardcoded enum, for consistency and because some teams
do want to rename/reorder/recolor priority levels (e.g. add a "Critical"
tier above Urgent).

## Schema

Add to `db/schema/ticket-config.ts` (same file as statuses/categories):

```ts
export const ticketPriorities = pgTable("ticket_priorities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("slate"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Add to `db/schema/tickets.ts`:

```ts
priority: text("priority").notNull().default("normal"),
```

(Plain text slug, no FK — matches how `status`/`category` are stored on
`tickets` today; validated against `ticketPriorities` at write time, same
as the existing pattern in `lib/ticket-config.ts`.)

Index: `index("tickets_priority_idx").on(t.priority)` for the future
filter/sort.

### Seed data

Add to `scripts/seed-defaults.ts` (same shape as `defaultStatuses`):

```ts
const defaultPriorities = [
  { slug: "low",    label: "Low",    color: "slate",  sortOrder: 0, isDefault: false },
  { slug: "normal", label: "Normal", color: "blue",   sortOrder: 1, isDefault: true  },
  { slug: "high",   label: "High",   color: "amber",  sortOrder: 2, isDefault: false },
  { slug: "urgent", label: "Urgent", color: "red",    sortOrder: 3, isDefault: false },
];
```

The migration for existing installs needs a data-migration step (not just
schema): after adding the column with `default('normal')`, existing rows
already get `normal` for free from the column default — no backfill script
needed as long as `pnpm db:migrate` runs before `pnpm db:seed` seeds the
`ticket_priorities` config rows (order matters: seed the config table
first or simultaneously; the `tickets.priority` text values are just
strings and don't depend on `ticket_priorities` existing to be valid,
matching how `status`/`category` already work).

## API changes

- `lib/ticket-config.ts`: add `getTicketPriorities()`, `getDefaultPriority()`
  — same shape as the existing status/category getters.
- `app/api/admin/priorities/route.ts` + `app/api/admin/priorities/[id]/route.ts`
  — copy `app/api/admin/statuses/route.ts` and its `[id]` route verbatim,
  swap the table. (No `isClosedState` equivalent needed.)
- `app/api/tickets/route.ts` (`POST`, ticket creation): set
  `priority: (await getDefaultPriority())?.slug ?? "normal"` on insert,
  same pattern as `status: defaultStatus?.slug ?? "open"`.
- `app/api/tickets/[id]/route.ts` (`PATCH`): accept an optional `priority`
  field alongside the existing `status`/`category`/`assignedAgentId`,
  validate against `getTicketPriorities()`, log a `ticketActivity` row
  (`action: "priority_changed"`, `metadata: { from, to }` — mirror
  `status_changed`'s shape exactly).

## UI changes

1. **`/admin/ticket-config`** — add a third `PriorityManager` section,
   copy-paste `StatusesManager` minus the `isClosedState` checkbox.
2. **Ticket list (`app/(agent)/tickets/page.tsx`)** — add a Priority column
   (badge, same `COLOR_BADGE` system already used for status/category) —
   likely replaces or sits next to Category depending on space; given the
   column-width work already done this session, plan for `hidden md:table-cell`
   at a similar width to Category. Add a `priority` filter to
   `TicketFilters` using the same `SearchableSelect` pattern as
   status/category.
3. **Ticket detail sidebar
   (`ticket-info-sidebar.tsx`)** — add a Priority `SearchableSelect`
   control right next to the existing Status control, same `h-8 text-xs`
   sizing, colored trigger like Status's `COLOR_BADGE`-tinted border.
4. **Dashboard** — optional: a 5th stat card or a priority breakdown isn't
   in scope for this plan; revisit if wanted after the base feature ships.

## Task checklist

- [ ] `db/schema/ticket-config.ts` — add `ticketPriorities`
- [ ] `db/schema/tickets.ts` — add `priority` column + index
- [ ] `pnpm db:generate` + review + `pnpm db:migrate`
- [ ] `scripts/seed-defaults.ts` — seed 4 default priorities
- [ ] `lib/ticket-config.ts` — priority getters
- [ ] `app/api/admin/priorities/` — CRUD routes
- [ ] `app/api/tickets/route.ts` — set default priority on create
- [ ] `app/api/tickets/[id]/route.ts` — accept `priority` in `PATCH` +
      activity logging
- [ ] `/admin/ticket-config` — `PriorityManager` UI section
- [ ] Ticket list — Priority column + filter
- [ ] Ticket detail sidebar — Priority control
- [ ] Manual test: change a ticket's priority, confirm the badge, the
      activity entry, and the list filter all reflect it

## Out of scope

- SLA/due-date tracking tied to priority (separate, larger feature — not
  currently planned per the earlier audit; revisit only if requested).
- Auto-escalation (e.g. auto-bump priority after N hours unanswered).
