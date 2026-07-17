# Tickets

## Overview

A ticket is the core entity of the support tool. It represents a support request submitted by a customer and worked on by agents.

---

## Ticket Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid2 | Internal unique ID |
| `ticketNumber` | serial integer | Human-readable ID (#1001, #1002…) |
| `subject` | text | Short summary of the issue |
| `description` | text | Tiptap JSON (rich text), same as reply `content`. Legacy rows may be plain text — readers tolerate both. Flatten with `richTextToPlainText()` for previews/emails |
| `category` | text (slug) | References `ticket_categories.slug` — admin-configurable |
| `status` | text (slug) | References `ticket_statuses.slug` — admin-configurable |
| `customerName` | text | Name provided by the customer |
| `customerEmail` | text | Email provided by the customer |
| `customerToken` | text (cuid2) | Secret token for customer access — never exposed to agents via API |
| `assignedAgentId` | text (FK) | Agent assigned to this ticket (nullable) |
| `closedAt` | timestamp | When the ticket was closed (nullable) |
| `createdAt` | timestamp | When the ticket was created |
| `updatedAt` | timestamp | When the ticket was last updated |

---

## Categories

Categories are **admin-configurable** — managed at `/admin/ticket-config`. They are stored in the `ticket_categories` table. The `category` field on a ticket stores the category's **slug** (stable identifier, never changes after creation).

Default seeded categories (installed on first `pnpm seed`):

| Slug | Label | Color |
|------|-------|-------|
| `bug` | Bug | Red |
| `issue` | Issue | Orange |
| `feature_request` | Feature Request | Purple |
| `billing` | Billing | Green |
| `general_query` | General Query | Slate |

Admins can add, rename, recolor, reorder, and delete categories. A category cannot be deleted if any tickets currently use it.

---

## Statuses

Statuses are **admin-configurable** — managed at `/admin/ticket-config`. They are stored in the `ticket_statuses` table. The `status` field on a ticket stores the status's **slug**.

Each status has two special flags:
- **`isDefault`** — exactly one status must be default. Applied automatically to new tickets.
- **`isClosedState`** — setting a ticket to this status sets `closedAt` and triggers the "closed" email notification.

Default seeded statuses (installed on first `pnpm seed`):

| Slug | Label | Color | Default | Closed State |
|------|-------|-------|---------|--------------|
| `open` | Open | Blue | Yes | No |
| `in_progress` | In Progress | Amber | No | No |
| `closed` | Closed | Slate | No | Yes |

### Status Transitions

```
open ──────────────────► in_progress ──► closed
 ▲                                          │
 └──────────────────────────────────────────┘ (reopen)
```

- **Customer** can: close their own ticket (any non-closed-state → any closed-state), reopen their own ticket (any closed-state → the default status).
- **Agent/Admin** can: change status to any value.

### Business Rules

- There must always be at least one status with `isDefault = true`. Setting a new default automatically unsets the previous one.
- There must always be at least one status with `isClosedState = true`.
- A status cannot be deleted if any tickets currently use it.
- Admin-added statuses are treated the same as built-in ones for all workflow logic.

---

## Tags

Tags are **freeform** — any agent can type a new tag on a ticket; it's created in a shared pool (`tags` table) on first use and then autocompleted for everyone (unlike Statuses/Categories/Priorities, there is no admin management screen). A ticket can have any number of tags, via the `ticket_tags` join table (many-to-many).

- Tag names are normalized (trimmed, collapsed whitespace, lowercased) so `"Billing"` and `"billing "` share one row.
- Managed from the ticket detail page's "Tags" sidebar card — add via the "+ Add tag" popover (search existing or create new), remove via the `×` on a tag chip.
- `POST /api/tickets/{id}/tags` (body `{ name }`) and `DELETE /api/tickets/{id}/tags/{tagId}` — both agent/admin only.
- `GET /api/tags?q=…` — autocomplete search across the shared pool.
- Adding/removing a tag logs a `tag_added`/`tag_removed` row in `ticket_activity`.
- Not currently filterable on the ticket list page (detail-page-only for now).

---

## Ticket Number

- `ticket_number` is a PostgreSQL `serial` (auto-increment integer).
- Always displayed with a `#` prefix in the UI: `#1001`.
- Used for searching — agents can search by ticket number.
- Never editable.

---

## Comments / Replies

All communication on a ticket (customer replies + agent replies + internal notes) is stored in `ticket_comments`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid2 | |
| `ticketId` | text FK | |
| `authorId` | text | FK → `user.id` for agents; `null` for customer comments |
| `authorName` | text | Stored at write time — preserved if agent is later deleted |
| `authorRole` | enum | `customer` / `agent` / `admin` |
| `content` | text | Tiptap JSON (rich text). Legacy rows may be plain text — readers tolerate both. Flatten with `richTextToPlainText()` for previews/emails |
| `isInternal` | boolean | If true: visible to agents/admins only — never sent to customer |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### Internal Notes

- Internal notes (`is_internal = true`) are only visible to agents and admins.
- They are stripped server-side from all customer-facing API responses.
- They are visually distinguished in the agent portal (e.g. yellow background, lock icon).
- Customers never see internal notes — not in the UI, not via the API.

---

## Attachments

Attachments can be added to the initial ticket or to any comment/reply.

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid2 | |
| `ticketId` | text FK | |
| `commentId` | text FK (nullable) | null = attached to the ticket itself, not a comment |
| `filename` | text | Original filename shown in UI |
| `storageKey` | text | Storage path — never a full URL |
| `fileSize` | integer | Bytes |
| `mimeType` | text | |
| `uploadedBy` | text | `user.id` for agents; `customerEmail` for customer uploads |
| `createdAt` | timestamp | |

See [file-uploads.md](./file-uploads.md) for upload rules and validation.

---

## Activity History

Every significant action on a ticket is logged in `ticket_activity` for a full audit trail.

| Action | Description |
|--------|-------------|
| `ticket_created` | Ticket was submitted |
| `status_changed` | Status changed from X to Y |
| `assigned` | Ticket assigned to agent |
| `unassigned` | Ticket unassigned |
| `comment_added` | Customer or agent replied |
| `internal_note_added` | Internal note added (visible to agents only) |
| `ticket_closed` | Ticket was closed |
| `ticket_reopened` | Ticket was reopened |
| `attachment_added` | File attached |
| `tag_added` | Tag added to the ticket |
| `tag_removed` | Tag removed from the ticket |

```
ticket_activity
+-- id          cuid2 PK
+-- ticket_id   FK → tickets.id (cascade delete)
+-- actor_id    text nullable (null = customer action, since customers have no user.id)
+-- actor_name  text (stored at write time)
+-- actor_role  enum: customer / agent / admin / system
+-- action      text
+-- metadata    jsonb  ← e.g. { from: 'open', to: 'in_progress' }
+-- created_at  timestamp
```

Activity history is displayed chronologically on the ticket detail page for agents. Customers see a simplified version (status changes + replies — no internal note activity).

---

## Business Rules

1. Ticket numbers are sequential integers starting from 1001 (first ticket is #1001).
2. A customer can only see their own tickets (enforced by `customerToken` — not by any shared session).
3. A customer cannot see internal notes — ever.
4. A customer cannot assign tickets or change the assigned agent.
5. Only agents and admins can mark a ticket `in_progress` — customers cannot set this status.
6. Closing a ticket does not delete any data.
7. Attachments are deleted from storage before the DB record is deleted.
8. When an agent account is deleted, their `assignedAgentId` references are set to `null` (ticket becomes unassigned). Their name is preserved in comment `authorName`.
9. `customerToken` is never returned in any agent-facing API response.
10. The ticket `updatedAt` timestamp is bumped whenever a new comment is added or the status changes.

---

## API Endpoints

| Method | Route | Actor | Description |
|--------|-------|-------|-------------|
| POST | `/api/tickets` | Customer (no auth) | Create a ticket |
| GET | `/api/tickets` | Agent/Admin | List all tickets (paginated, filterable) |
| GET | `/api/tickets/mine` | Customer (token) | List tickets for a customer email (via token in query) |
| GET | `/api/tickets/{id}` | Customer (token) / Agent | Get ticket details |
| PATCH | `/api/tickets/{id}` | Agent/Admin | Update status or assigned agent |
| PATCH | `/api/tickets/{id}/close` | Customer (token) / Agent | Close the ticket |
| PATCH | `/api/tickets/{id}/reopen` | Customer (token) / Agent | Reopen the ticket |
| POST | `/api/tickets/{id}/comments` | Customer (token) / Agent | Add a comment or internal note |
| DELETE | `/api/tickets/{id}` | Admin only | Hard delete (spam removal) |
