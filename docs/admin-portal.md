# Admin Portal

## Overview

The admin portal gives admins full control over the support tool — everything an agent can do, plus user management, role assignment, and spam ticket deletion.

Admins use the same agent portal routes (`/dashboard`, `/tickets`) with additional capabilities unlocked by their role. Admin-only sections live under `/(admin)/`.

Access requires a session with `role: admin`.

---

## Admin Capabilities (vs. Agent)

| Capability | Agent | Admin |
|------------|-------|-------|
| View all tickets | Yes | Yes |
| Search & filter tickets | Yes | Yes |
| Assign tickets | Yes | Yes |
| Reply to customers | Yes | Yes |
| Add internal notes | Yes | Yes |
| Change ticket status | Yes | Yes |
| Close / Reopen tickets | Yes | Yes |
| Delete tickets (spam) | No | **Yes** |
| View all users | No | **Yes** |
| Assign / change user roles | No | **Yes** |
| Ban / unban users | No | **Yes** |
| Promote to admin | No | **Yes** (or via CLI) |
| View cross-agent reports (`/admin/reports`) | No | **Yes** |

---

## 1. User Management (`/admin/users`)

### User List

Shows all registered users (agents + admins). Paginated — 25 per page.

Each row shows:
- Avatar + name + email
- Role badge (Agent / Admin)
- Status (Active / Banned)
- Joined date

### Search

Search by name or email.

### Actions Per User

| Action | Description |
|--------|-------------|
| Change Role | Set to `agent` or `admin` |
| Reset Password | Directly set a new password for the user — no old password required, nothing emailed. Only shown when password sign-in is enabled. |
| Ban User | Immediately revokes all sessions. User cannot sign in. Optionally enter a ban reason. |
| Unban User | Restores sign-in access. |
| Delete User | Hard delete — removes user record and their sessions. Their tickets remain unassigned. Their comment `authorName` is preserved as their name at time of deletion. |

### Assign Role Flow

1. Admin clicks "Change Role" on a user row.
2. A small popover/dialog appears: "Set role for [name]" — radio: Agent / Admin.
3. Confirm.
4. Role updated immediately. If the user is currently signed in, their next request will reflect the new role (session is not revoked — role is read from DB on each request).

### Reset Password Flow

1. Admin clicks "Reset Password" on a user row (hidden if password sign-in is disabled platform-wide).
2. Dialog: enter a new password (min 8 characters) and confirm it.
3. Confirm. The user's password is updated immediately — no email is sent, so the admin must share the new password with the user themselves.
4. The user's existing sessions are unaffected; they keep using the app until they next sign out, then sign back in with the new password.

### Ban Flow

1. Admin clicks "Ban User".
2. Dialog: "Ban [name]? They will be signed out immediately and cannot sign in until unbanned."
3. Optional: enter a ban reason (shown in the user list for admin reference).
4. Confirm.
5. Better Auth revokes all active sessions for that user.

### Delete User Flow

1. Admin clicks "Delete User".
2. Confirmation dialog: "Permanently delete [name]? This cannot be undone. Their assigned tickets will become unassigned."
3. Admin must type the user's email to confirm.
4. On confirm:
   - All sessions deleted.
   - `account` and `user` records deleted.
   - Any tickets assigned to this user set `assignedAgentId = null`.
   - Comment `authorName` is preserved (already stored at write time).

---

## 2. Delete Ticket (Spam) (`/tickets/{ticketId}`)

Admins see a "Delete Ticket" button in the ticket detail sidebar that agents do not see.

### Flow

1. Admin clicks "Delete Ticket".
2. Confirmation dialog: "Permanently delete ticket #1042? All comments and attachments will be deleted. This cannot be undone."
3. On confirm:
   - All attachments deleted from storage first (files deleted before DB records).
   - All `ticket_comments` deleted (cascade).
   - All `ticket_activity` deleted (cascade).
   - All `ticket_attachments` deleted (cascade).
   - `ticket` record deleted.
4. Admin redirected to `/tickets`.

---

## 3. Ticket Configuration (`/admin/ticket-config`)

Admins can manage the statuses and categories used across all tickets. Changes take effect immediately for all new and existing ticket displays.

### 3a. Statuses

Displays all ticket statuses in `sortOrder` order.

Each status row shows:
- Color swatch + label + slug (read-only)
- **Default** badge (if `isDefault = true`) — shown as a green "Default" chip
- **Closed State** badge (if `isClosedState = true`) — shown as a gray "Closed State" chip
- Edit + Delete buttons

**Add Status** — a form/dialog with:
- Label (text input) — slug auto-generated from label on creation, shown as read-only preview
- Color (preset picker: Blue / Amber / Slate / Red / Orange / Purple / Green / Teal / Pink / Indigo)
- Mark as default (checkbox)
- Mark as closed state (checkbox)

**Edit Status** — dialog pre-filled with existing values. Slug is read-only (immutable after creation).

**Delete Status** — blocked if:
- It is the only remaining status
- It is the current default status
- Any tickets currently use this status slug (show count in error)

**Setting a new default** — when admin marks a status as default, the previous default is automatically unset. There is always exactly one default.

### 3b. Categories

Same pattern as statuses, minus the `isDefault` and `isClosedState` flags.

**Add Category** — label + color picker.

**Edit Category** — label and color only (slug immutable).

**Delete Category** — blocked if any tickets currently use this category slug.

### 3c. SLA Policies

Displays all SLA policies in `sortOrder` order. Each policy has a name, an optional priority/category scope (both default to "Any"), and three targets in minutes: First Response, Next Response, Resolution. See `docs/tickets.md` § SLA for the full model (scoping precedence, the three metrics, pause/resume behavior).

Each policy row shows:
- Name + scope (e.g. "Any priority · Any category", "Urgent · Billing")
- **Default** badge (if `isDefault = true`)
- The three targets, formatted (e.g. "1h 30m")
- Edit + Delete buttons

**Add/Edit Policy** — a form/dialog with:
- Name (text input)
- Priority scope (select: Any + each configured priority)
- Category scope (select: Any + each configured category)
- First Response / Next Response / Resolution (minute inputs)
- Mark as default (checkbox — only enabled when both scope selects are "Any"; only an unscoped policy can be the global fallback)

**Delete Policy** — blocked if it is the current default policy (set another policy as default first). Unlike statuses/categories, there's no "tickets currently use this" check — policies aren't referenced by id on `tickets`, they're resolved live by matching priority/category.

**Setting a new default** — when admin marks a policy as default, the previous default is automatically unset, same pattern as statuses/priorities.

### 3d. Color Presets

Both statuses and categories use a fixed set of named color presets for badge styling. Stored as a color name in the DB, resolved to Tailwind classes at render time via `COLOR_BADGE` in `lib/tickets.ts`:

| Name | Badge classes |
|------|--------------|
| `blue` | `bg-sky-100 text-sky-700 border-sky-200` |
| `amber` | `bg-amber-100 text-amber-700 border-amber-200` |
| `slate` | `bg-stone-100 text-stone-600 border-stone-200` |
| `red` | `bg-red-50 text-red-700 border-red-200` |
| `orange` | `bg-orange-50 text-orange-700 border-orange-200` |
| `purple` | `bg-purple-50 text-purple-700 border-purple-200` |
| `green` | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `teal` | `bg-teal-50 text-teal-700 border-teal-200` |
| `pink` | `bg-pink-50 text-pink-700 border-pink-200` |
| `indigo` | `bg-indigo-50 text-indigo-700 border-indigo-200` |

### 3e. Seeding Defaults

On a fresh install, run `pnpm seed` to populate `ticket_statuses`, `ticket_categories`, `ticket_priorities`, and a default `sla_policies` row with the default values documented in `docs/tickets.md`. This is idempotent — it skips rows that already exist (by slug for statuses/categories/priorities, by a fixed id for the seeded SLA policy).

---

## 4. Reports (`/admin/reports`)

Admin-only — the only place in the app that compares agents against each other, which is why it's gated to admin rather than shared with the agent dashboard (`/dashboard`, which stays identical for agents and admins). Answers "who's busy, and how fast are we?"

A range toggle (**Last 30 days** / **Last 90 days** / **All time**, default 30 days) applies to every report below and to its CSV export, filtered on ticket creation date.

### 4a. Tickets per Agent

One row per agent (by *current* assignment — not reassignment history) plus an **Unassigned** row: Total tickets, Open tickets, Avg First Response, Avg Resolution.

- **Avg First Response** — average time from ticket creation to that agent's first public reply (`tickets.firstRespondedAt - tickets.createdAt`).
- **Avg Resolution** — average `tickets.slaActiveSeconds` (accumulated agent-active time toward resolution — already excludes time spent waiting on the customer, see `docs/tickets.md` § SLA) across that agent's closed tickets. This is a materially better "how fast do we resolve" number than a naive `closedAt - createdAt`, since it doesn't penalize an agent for a customer who took 3 days to reply.
- Both averages are blank ("—") for an agent with no qualifying tickets yet (no replies sent / no tickets closed) in the selected range.

### 4b. Tickets by Category / Priority / Tag

Three breakdown tables — Category and Priority show count + share of total; Tag shows count only (a ticket can have multiple tags, so tag shares wouldn't sum to 100%) and is capped to the **top 20 tags** by ticket count (tags are an unbounded freeform pool — see `docs/tickets.md` § Tags).

### 4c. CSV Export

Every report has its own "Download CSV" link — a plain download, no dialog or client-side processing. Respects the current range selection. Time columns in the CSV are raw seconds (not formatted "2h 15m" strings) — a CSV is for further spreadsheet analysis, where raw numbers are more useful than pre-formatted text.

---

## 5. Audit Log (`/admin/audit-log`)

A system-wide, admin-only trail of sensitive actions — separate from `ticket_activity` (which is per-ticket and shown in the ticket detail sidebar; see `docs/tickets.md`). Newest first, paginated 25 per page.

Logged today: user role changes/bans/deletes, ticket deletion (single and bulk), ticket bulk actions, every ticket-config change (statuses/categories/priorities/SLA policies/custom fields), email template edits, platform/appearance settings changes (including the sign-in method toggles), API key create/revoke, plus all the auth/profile/session events from the Better Auth side. See `docs/plans/07-audit-log-viewer.md`'s addendum for the full list and the reasoning behind what's deliberately *not* logged (read-only routes, field-level renames that don't change access or config).

- **Search** — matches `description` or `actorEmail` (`ilike`).
- **Action filter** — a dropdown populated from a live `SELECT DISTINCT action` over the table itself, not a hardcoded list, so it can never miss an action type that's actually been logged.
- Click a row with metadata to expand the raw JSON — useful for debugging without a dedicated column per possible shape.
- Failing to write an audit entry never breaks the action it's describing — `audit()` swallows its own errors (logged to the server console) rather than throwing.

## 6. Admin Access to Orbit Panel

Admins also have access to the Better Auth Orbit panel at `/orbit`:
- View all user sessions.
- Impersonate any user (for debugging).
- View email outbox (sent emails).
- View job queue state (pg-boss).

This is provided by the scaffold — no custom implementation needed.

---

## 7. Business Rules

1. There must always be at least one admin in the system. Prevent the last admin from being demoted or deleted.
2. An admin cannot ban themselves.
3. Deleting a user does not delete their tickets or comments — tickets become unassigned.
4. Ticket deletion is hard delete — no soft delete, no recovery.
5. When deleting a ticket, always delete storage files before the DB record.
6. Role changes take effect on the user's next API request — no need to force sign-out.
7. Admins can manage users created by any auth method (magic link, Google).

---

## 8. UI Notes

- Admin-only items (Delete Ticket button, Users/Reports nav links) are conditionally rendered based on `session.user.role === 'admin'`.
- The Users and Reports pages (`/admin/users`, `/admin/reports`) are not linked in the agent sidebar — only visible to admins.
- Destructive actions (delete ticket, delete user, ban user) always use shadcn `Dialog` with explicit confirmation — never `window.confirm()`.
- Use Phosphor Icons: `TrashIcon` for delete, `ProhibitIcon` for ban, `ShieldCheckIcon` for admin role.
