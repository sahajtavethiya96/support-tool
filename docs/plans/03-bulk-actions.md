# Plan: Bulk actions on the ticket list

**Already documented** in `docs/agent-portal.md` under "Bulk Actions (Admin
only)":
> - Select multiple tickets with checkboxes.
> - Bulk assign to an agent.
> - Bulk change status.
> - Bulk delete (spam — admin only).

This plan implements exactly that. The doc scopes the whole toolbar to
**admin only** — flagging that as a decision point below in case you'd
rather let any agent bulk-assign/bulk-status (and keep only *delete*
admin-gated), but the default plan follows the doc as written.

## Goal

On `/tickets`, admins can select multiple rows via checkboxes and apply one
action (assign / change status / delete) to all of them at once.

## UI

The table body (`TicketsResults` in `app/(agent)/tickets/page.tsx`) is
currently a server component rendering plain `<tr>`s. Selection state is
inherently client-side, so:

1. Extract the `<table>` into a new client component,
   `app/(agent)/tickets/_components/tickets-table.tsx`, receiving `rows`,
   `statusMap`, `categoryMap`, `isAdmin` as props (data still fetched
   server-side in `TicketsResults`, just rendered by a client child — same
   pattern already used for `TicketFilters`).
2. Add a checkbox column (only rendered when `isAdmin`), a header checkbox
   for select-all-on-page, and local `useState<Set<string>>` for selected
   ticket IDs.
3. When `selected.size > 0`, show a floating action bar (sticky bottom or
   replacing the "N tickets" line) with:
   - "N selected" + "Clear"
   - **Assign to…** — opens the existing `SearchableSelect` populated with
     agents (reuse the same agents list already fetched for the ticket
     detail sidebar; add a small `getAgents()` helper in `lib/tickets.ts` if
     one doesn't already exist as a shared fetch)
   - **Change status to…** — `SearchableSelect` over `statuses`
   - **Delete** — destructive button → shadcn `Dialog` confirmation (per
     `CLAUDE.md`: never `window.confirm()`), input requires no typed
     confirmation (unlike user deletion) since it's undo-via-nothing but
     tickets are lower-stakes than accounts — just a clear "Delete N
     tickets? This cannot be undone." dialog with Cancel + destructive
     Delete buttons.
4. After a successful bulk action: clear selection, `router.refresh()`
   (same pattern used elsewhere in this app after a mutation) so the
   Suspense-wrapped `TicketsResults` re-fetches.

## API

One route, `app/api/tickets/bulk/route.ts`:

```ts
// PATCH /api/tickets/bulk — admin only
// body: { ids: string[], action: "assign" | "status", value: string | null }
```

```ts
// DELETE /api/tickets/bulk — admin only
// body: { ids: string[] }
```

Two verbs because delete needs the storage-cleanup path (see
`docs/file-uploads.md`'s "When a ticket is deleted" section) which is
meaningfully different work from a field update — keeping them separate
routes avoids one giant branchy handler.

### PATCH behavior

- `requireAdminFromRequest(request)` (mirror `lib/authz.ts` pattern used
  elsewhere).
- Validate `ids` non-empty, reasonable max (e.g. 200) to avoid one request
  updating the whole table by accident.
- For `action: "assign"`: `value` is an agent id or `null` (unassign).
  Validate the agent exists and has `role` agent/admin if non-null.
- For `action: "status"`: `value` must be a valid `ticketStatuses.slug`
  (validate against `getTicketStatuses()`).
- `db.update(tickets).set({...}).where(inArray(tickets.id, ids))` — single
  query, not a loop.
- For each affected ticket, insert one `ticketActivity` row (action
  `status_changed` or `assigned`) — loop is fine here since these are cheap
  inserts, not the hot path.
- One `audit()` call summarizing the whole batch: `action: "ticket.bulk_update"`,
  `metadata: { ticketIds: ids, action, value }`.

### DELETE behavior

Mirror the existing single-ticket `DELETE /api/tickets/{id}` logic (already
built per Phase 6) but looped over `ids`:
1. For each ticket: fetch its attachments, `storage.delete()` each file.
2. `db.delete(tickets).where(inArray(tickets.id, ids))` — cascades to
   comments/attachments/activity via the existing FK `onDelete: "cascade"`.
3. One `audit()` call: `action: "ticket.bulk_delete"`,
   `metadata: { ticketIds: ids, count: ids.length }`.

## Decision point: who can bulk-assign/bulk-status?

The doc gates the entire toolbar behind admin. If you'd rather let any
agent select tickets and bulk-assign/bulk-status their own queue (a common
support-tool pattern), only gate **delete** behind admin and use
`requireAgentFromRequest` for the `PATCH` route instead. Flag your
preference before implementation — the plan defaults to matching the
existing doc (all admin-only) since that's what's already promised to
users.

## Task checklist

- [ ] `app/(agent)/tickets/_components/tickets-table.tsx` — client
      component with checkboxes + selection state
- [ ] Floating bulk-action bar + `SearchableSelect` pickers + delete `Dialog`
- [ ] `app/api/tickets/bulk/route.ts` — `PATCH` + `DELETE`
- [ ] Activity rows + `audit()` calls for both paths
- [ ] Update `docs/agent-portal.md` if the admin-only scoping changes
- [ ] Manual test: select 3 tickets, bulk-close them, confirm status +
      activity timeline on each; select 2, bulk-delete, confirm storage
      files are gone (`ls uploads/tickets/{id}` empty/removed) and rows are
      gone

## Out of scope

- Bulk category change (not in the doc; add later if requested — same
  pattern as status).
- Bulk actions on the dashboard's "recent tickets" widget — list page only.
