# Email Notifications

## Overview

Support Tool sends email notifications at key ticket lifecycle events. All emails are sent via SMTP (Nodemailer), queued through pg-boss, and built with react-email templates.

Customers are notified by **email**. Agents are notified **in-app** (notification bell)
when a customer replies — agents do not receive email. See [in-app-notifications.md](./in-app-notifications.md).

---

## Notification Events (email → customer)

| Event | Recipient | Trigger |
|-------|-----------|---------|
| Ticket created | Customer | Ticket is submitted |
| Agent replied | Customer | Agent posts a public reply |
| Ticket closed | Customer | Ticket status changes to a closed state |

> Customer replies notify agents **in-app only** (not by email). See the dedicated doc.

---

## 1. Ticket Created

**To:** Customer email (from ticket form)
**Subject:** `[#1042] Your ticket has been received — {subject}`

**Content:**
- Confirmation that the ticket was received.
- Ticket number and subject.
- A direct link to the ticket: `/ticket/{ticketId}?token={customerToken}`.
- Expected response time note (configurable platform setting — or generic "We'll get back to you as soon as possible.").
- Link to find all their tickets: `/my-tickets`.

---

## 2. Agent Replied

**To:** Customer email (from ticket)
**Subject:** `[#1042] New reply on your ticket — {subject}`

**Content:**
- Notification that a support agent has replied.
- The reply text (first 500 characters, with a "Read full reply" link if truncated).
- A direct link to the ticket: `/ticket/{ticketId}?token={customerToken}`.
- Link to reply: same ticket link — customer replies inline.

**Trigger condition:** Only sent for public replies (`is_internal = false`). Internal notes never trigger a customer notification.

---

## 3. Ticket Closed

**To:** Customer email (from ticket)
**Subject:** `[#1042] Your ticket has been closed — {subject}`

**Content:**
- Notification that the ticket has been closed.
- Option to reopen: link to the ticket with a note that they can reply or click "Reopen" if they need further help.
- Satisfaction feedback (optional — out of scope for MVP).

---

## Customer Replied → agents (in-app, not email)

When a customer replies, agents are notified **in the app** via the notification bell —
no email is sent. Full details in [in-app-notifications.md](./in-app-notifications.md).

---

## Email Queue

All emails are sent via pg-boss queue — never synchronously in the API request.

### Flow

1. API route or server action triggers an email event.
2. `enqueueEmail()` from `lib/email/index.ts` is called with `{ to, subject, html, text }`.
3. This stores the email in the `email_outbox` table and enqueues a pg-boss job.
4. The worker processes the job and sends via Nodemailer.
5. On success: `email_events` record updated with `sent_at`.
6. On failure: pg-boss retries up to 3 times with exponential backoff.

### Enqueue Helper

```typescript
// lib/email/index.ts — already in scaffold

await enqueueEmail({
  to: ticket.customerEmail,
  subject: `[#${ticket.ticketNumber}] Your ticket has been received — ${ticket.subject}`,
  html,
  text,
})
```

---

## Email Templates

Built with react-email. Templates live in `lib/email/templates/`.

| Template | File |
|----------|------|
| Ticket created | `lib/email/templates/ticket-created.tsx` |
| Agent replied | `lib/email/templates/ticket-replied.tsx` |
| Ticket closed | `lib/email/templates/ticket-closed.tsx` |
| My tickets list | `lib/email/templates/my-tickets-list.tsx` |

Each template exports an async function that accepts typed props and returns `{ html, text }`.

### Template Props

```typescript
// ticket-created.tsx
type TicketCreatedProps = {
  customerName: string
  ticketNumber: number
  ticketSubject: string
  ticketUrl: string           // /ticket/{id}?token={token}
  myTicketsUrl: string        // /my-tickets
  productName: string
}

// ticket-replied.tsx
type TicketRepliedProps = {
  customerName: string
  ticketNumber: number
  ticketSubject: string
  replyPreview: string        // first 500 chars of the reply
  ticketUrl: string
  agentName: string
  productName: string
}

// ticket-closed.tsx
type TicketClosedProps = {
  customerName: string
  ticketNumber: number
  ticketSubject: string
  ticketUrl: string
  productName: string
}
```

---

## SMTP Configuration

All SMTP settings are environment variables:

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | Port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | From address, e.g. `Support <support@yourco.com>` |

If `SMTP_HOST` is not set, the worker logs emails to console instead of sending them (dev-friendly behavior inherited from scaffold). In all cases, links inside outgoing emails are also printed to the server console in non-production for quick access.

---

## Business Rules

1. Only public replies trigger a customer notification — internal notes do not.
2. Notifications are sent asynchronously — API responses do not wait for email delivery.
3. If email delivery fails after 3 retries, the job is moved to the pg-boss dead-letter queue. The ticket operation (create, reply, close) is not rolled back.
4. The `customerToken` embedded in email links is the same token stored in the ticket record — it never expires and does not need to be refreshed.
5. The `productName` in email templates is sourced from `config/platform.ts` (the `PRODUCT_NAME` constant).

---

## Out of Scope (MVP)

- Agent email notifications for events other than customer replies (e.g. new ticket assigned)
- Per-agent notification preferences / digest batching
- Customer email notifications for status changes other than "closed"
- Email unsubscribe / preference management
- HTML email tracking (open/click tracking)
- CC / BCC on tickets
