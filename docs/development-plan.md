# Development Plan

## Overview

Work through phases in order. Do not start a phase until the previous phase is complete.

---

## Phase 1 — Foundation & Project Setup

**Goal:** Clean up the KROVA scaffold and set up the project conventions for the support tool.

- [ ] Rename project in `package.json` from `krova-scaffold` to `support-tool`
- [ ] Update `config/platform.ts` with product name and branding
- [ ] Set up roles in Better Auth: extend `user.role` to support `agent` | `admin` | `null`
- [ ] Configure Google OAuth (optional, environment-gated like Kanbanica)
- [ ] Create route groups: `(customer)/`, `(agent)/`, `(admin)/`
- [ ] Implement route group layouts with role-based guards (middleware)
- [ ] Port/adapt login page UI from Kanbanica (magic link + Google OAuth button)
- [ ] Update `docs/commands.md` with support-tool-specific commands
- [ ] Set up `lib/storage.ts` with files-sdk adapter (local fs in dev)
- [ ] Create `/api/files/[...key]/route.ts` to serve uploaded files

**Deliverable:** App starts, `/login` works (magic link + Google if configured), route protection is in place, file serving works.

---

## Phase 2 — Database Schema

**Goal:** Define and migrate all support tool tables.

- [ ] Create `db/schema/tickets.ts` with: `tickets`, `ticket_comments`, `ticket_attachments`, `ticket_activity`
- [ ] Export all new tables from `db/schema/index.ts`
- [ ] Generate migration: `pnpm db:generate`
- [ ] Apply migration: `pnpm db:migrate`
- [ ] Verify all tables and indexes are created correctly

**Deliverable:** All 4 tables exist in the database with correct columns, types, and indexes.

---

## Phase 3 — Customer Portal: Create & Submit Ticket

**Goal:** Customers can submit a ticket without logging in.

- [ ] `/(customer)/layout.tsx` — minimal public layout (header + content)
- [ ] `/(customer)/page.tsx` — landing page with "Submit a Ticket" CTA
- [ ] `/(customer)/submit/page.tsx` — ticket creation form
- [ ] `/(customer)/submit/success/page.tsx` — confirmation page
- [ ] `POST /api/tickets` — create ticket, generate `customerToken`, enqueue confirmation email
- [ ] File upload support in the create form (via `/api/tickets/{id}/attachments`)
- [ ] Client-side and server-side form validation

**Deliverable:** A customer can visit `/submit`, fill in the form, submit, and see the success page.

---

## Phase 4 — Customer Portal: View & Manage Tickets

**Goal:** Customers can access, reply to, and manage their own tickets.

- [ ] `/(customer)/ticket/[ticketId]/page.tsx` — ticket detail view
- [ ] Token validation on every request to this route
- [ ] Display ticket info, status, category, description
- [ ] Display comment thread (public replies only — no internal notes)
- [ ] Display attachments
- [ ] Reply form (Tiptap rich text + optional attachment)
- [ ] `POST /api/tickets/{id}/comments` for customer replies (requires token)
- [ ] Close ticket button + confirmation dialog
- [ ] Reopen ticket button
- [ ] `/(customer)/my-tickets/page.tsx` — email input to receive ticket links
- [ ] `POST /api/tickets/send-access-email` — sends email with all ticket links for an email address

**Deliverable:** Customer can view their ticket, reply, close, reopen, and find all their tickets via email.

---

## Phase 5 — Agent Portal: Ticket List & Detail

**Goal:** Agents can view, search, filter, and manage all tickets.

- [ ] `/(agent)/layout.tsx` — sidebar navigation layout (session guard)
- [ ] `/(agent)/tickets/page.tsx` — all tickets list with pagination, search, filters
- [ ] `/(agent)/tickets/[ticketId]/page.tsx` — full ticket detail view
- [ ] Two-column layout: comment thread (left) + info sidebar (right)
- [ ] Display all comments including internal notes (with visual distinction)
- [ ] Display full activity history
- [ ] Status change control (dropdown or button group in sidebar)
- [ ] Agent assignment dropdown
- [ ] "Assign to me" shortcut
- [ ] Reply form (Tiptap rich text; public reply tab + internal note tab)
- [ ] Close / Reopen ticket in sidebar
- [ ] `GET /api/tickets` — paginated list with search/filter query params
- [ ] `GET /api/tickets/{id}` — full detail (includes internal notes for agents)
- [ ] `PATCH /api/tickets/{id}` — update status and/or assignedAgentId
- [ ] `PATCH /api/tickets/{id}/close` and `/reopen`
- [ ] `POST /api/tickets/{id}/comments` for agent replies and internal notes

**Deliverable:** Agents can manage tickets fully — view, filter, assign, reply, add internal notes, change status.

---

## Phase 6 — Admin Portal: User Management & Ticket Deletion

**Goal:** Admins can manage users and delete spam tickets.

- [ ] `/(admin)/users/page.tsx` — user list with search
- [ ] Role change (agent ↔ admin) via dialog
- [ ] Ban / unban via dialog
- [ ] Delete user via dialog (requires typing email to confirm)
- [ ] `GET /api/users` — list users (admin only)
- [ ] `PATCH /api/users/{id}` — update role or ban status (admin only)
- [ ] `DELETE /api/users/{id}` — delete user (admin only)
- [ ] "Delete Ticket" button on ticket detail (admin only)
- [ ] `DELETE /api/tickets/{id}` — hard delete with storage cleanup (admin only)
- [ ] "Last admin" protection — prevent demoting or deleting the last admin

**Deliverable:** Admins can manage users and delete spam tickets.

---

## Phase 7 — Email Notifications

**Goal:** Customers receive email notifications for key events.

- [ ] `lib/email/templates/ticket-created.tsx` — react-email template
- [ ] `lib/email/templates/ticket-replied.tsx` — react-email template
- [ ] `lib/email/templates/ticket-closed.tsx` — react-email template
- [ ] Enqueue `ticket.created` email after ticket creation (in Phase 3 API)
- [ ] Enqueue `ticket.replied` email after public agent reply
- [ ] Enqueue `ticket.closed` email after ticket is closed (by agent or customer)
- [ ] Worker handler for each email job type
- [ ] Test all three emails in dev (check console output when SMTP not configured)

**Deliverable:** All three customer email notifications send correctly.

---

## Phase 8 — Dashboard

**Goal:** Agents and admins see ticket stats and quick access to open tickets.

- [ ] `/(agent)/dashboard/page.tsx` — dashboard layout
- [ ] Four stat cards: Total, Open (+ avg wait), In Progress, Closed
- [ ] Ticket volume bar chart (7d / 30d toggle)
- [ ] "Recent Open Tickets" table (last 10 by updatedAt)
- [ ] "My Tickets" section (assigned to me, open/in-progress)
- [ ] `GET /api/stats/overview` — counts + avg wait time
- [ ] `GET /api/stats/volume?days=7` — daily ticket counts
- [ ] Redirect `/dashboard` → `/tickets` for agents if dashboard is not ready yet (temporary)

**Deliverable:** Dashboard shows live stats and quick access to tickets.

---

## Phase 9 — Polish & Activity History

**Goal:** Activity history is visible in ticket detail, UI is polished, empty states are in place.

- [ ] Activity timeline component (chronological event list in ticket sidebar)
- [ ] Customer-facing simplified activity (status changes + replies only)
- [ ] Agent-facing full activity (all events)
- [ ] All empty states implemented (see [design-system.md](./design-system.md))
- [ ] Mobile responsiveness review — customer portal and agent portal
- [ ] Error pages: 404 (invalid token), 500 (server error)
- [ ] Consistent border radius audit across all surfaces
- [ ] Loading states and skeleton screens for ticket list and detail
- [ ] Toast notifications for all success/error actions

**Deliverable:** App is polished, handles edge cases, works well on mobile.

---

## Phase 10 — Open Source & Self-Hosted Packaging

**Goal:** Anyone can install and run this app on their own infrastructure.

- [ ] `docker-compose.yml` — app + worker + postgres services
- [ ] `Dockerfile` for the Next.js app
- [ ] `.env.example` with all variables documented and described
- [ ] Update `README.md` with quick start, Docker, and deployment guides
- [ ] `scripts/setup.ts` — guided first-run setup (check env vars, run migrations, prompt for first admin email)
- [ ] Document: Railway, Render, Fly.io one-click deploy options
- [ ] Document: VPS self-hosted with PM2 + Nginx
- [ ] `CONTRIBUTING.md` — how to contribute

**Deliverable:** Anyone can clone the repo, follow the README, and have a running instance in under 10 minutes.

---

## Current Phase

**All core phases (1–10) are complete.** The app is feature-complete and
self-hostable via Docker (`docker-compose.yml` + `Dockerfile`), with a guided
`pnpm setup` for first-run migrations/seeding/admin creation.

### Beyond the original plan

Two features were added that were not in the initial phases:

- **Dynamic ticket statuses & categories** — admins manage statuses/categories at
  `/admin/ticket-config`. Statuses carry `isDefault` / `isClosedState` flags; no code
  hardcodes status slugs (see `lib/ticket-config.ts`).
- **Theme & appearance system** — admins pick a color theme + light/dark/auto at
  `/admin/appearance`; persisted in `platform_settings` and applied via `ThemeProvider`.
- **In-app notifications** — agents get a notification-bell alert when a customer replies
  (assigned agent, or all agents if unassigned). See `docs/in-app-notifications.md`.
  Agents are no longer emailed for customer replies.

### Remaining / nice-to-have

- One-click deploy templates (Railway/Render/Fly) — documented generically in the README,
  but no provider button/manifest files yet.
- Broader mobile-responsiveness pass on the agent ticket detail two-column layout.
- CSAT (post-close satisfaction rating) and a CSV export of tickets — deferred,
  no implementation plan written yet.
- `GET /api/health` endpoint for Docker healthchecks / uptime monitors — deferred,
  no implementation plan written yet.

### Recently completed

See [docs/plans/](./plans/00-overview.md) for the full write-up of each item.
Completed: the "My Tickets" list email (was a stub), Postgres-backed rate
limiting on public routes, deleting the unused `GET /api/tickets` stub,
bulk ticket actions, attachment deletion, canned/saved replies, ticket
priority, and the audit-log viewer (`/admin/audit-log`). Inbound
email-to-ticket was considered and intentionally skipped for now.
