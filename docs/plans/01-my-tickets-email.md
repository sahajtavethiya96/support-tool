# Plan: Complete the "My Tickets" list email

**Status:** documented in `docs/customer-portal.md` and
`docs/email-notifications.md`, but not actually implemented — currently a
stub that logs to the server console instead of sending.

## Goal

When a customer submits their email on `/my-tickets`, they receive a real
email containing a single secure link to their ticket list
(`/my-tickets/{signedToken}`), matching what the UI already promises
("we've sent you a list").

## Current state (`app/api/tickets/mine/send/route.ts`)

- Looks up all tickets for the submitted email — done.
- Generates the signed list-token via `signEmailToken()` — done.
- Builds `listUrl` — done.
- **Never calls `enqueueEmail()`.** Only `console.log`s the link. Has a
  `// TODO: enqueue email job` comment marking this.
- Always returns `{ ok: true }` regardless of whether tickets exist — this
  part is correct and must stay (prevents email enumeration).

## Plan

### 1. New email template

`lib/email/templates/my-tickets-list.tsx` — follow the exact structure of
`lib/email/templates/ticket-created.tsx` (same `EmailLayout`, `emailStyles`,
brand color `#384959`, `renderEmailTemplate`, returns `{ html, text }`).

Props:
```ts
{
  email: string;
  listUrl: string;      // the /my-tickets/{token} link
  ticketCount: number;  // for the preview/body copy
  productName: string;
}
```

Content:
- Heading: "Your support tickets"
- Body: "Here's a link to view all N of your tickets." (singular/plural)
- Button: "View My Tickets" → `listUrl`
- Fallback plain-text link (same pattern as other templates)
- Mention the link expires in 7 days (matches `signEmailToken`'s TTL in
  `lib/customer-access.ts` — keep the copy in sync with that constant)

No per-ticket list needed in the email body — the destination page already
renders the full grouped (Open/Closed) list. Keep the email itself minimal.

### 2. Wire it into the route

In `app/api/tickets/mine/send/route.ts`, replace the `console.log` block:

```ts
if (customerTickets.length > 0) {
  const listUrl = `${env.NEXT_PUBLIC_APP_URL}/my-tickets/${signEmailToken(email)}`;
  const { html, text } = await myTicketsListTemplate({
    email,
    listUrl,
    ticketCount: customerTickets.length,
    productName: PRODUCT_NAME,
  });
  enqueueEmail({
    to: email,
    subject: "Your support tickets",
    html,
    text,
  }).catch((err) => console.error("[my-tickets email]", err));
}
```

Fire-and-forget with `.catch()`, matching the pattern used for
`ticket.created` / `ticket.replied` / `ticket.closed` in the other routes —
don't `await` inside the request path in a way that blocks the response,
and never let an email failure change the response (still always `{ ok: true }`).

### 3. Docs

Update `docs/email-notifications.md`'s template table to add a 4th row:

| Notification | Template |
|---|---|
| My tickets list | `lib/email/templates/my-tickets-list.tsx` |

## Edge cases

- Zero tickets for the email → no email sent at all (current behavior,
  keep it — don't email "you have no tickets").
- Re-requesting quickly issues a new token each time (tokens aren't
  single-use, just time-limited) — fine, no dedupe needed.
- This route becomes a rate-limiting target once
  [02-rate-limiting.md](./02-rate-limiting.md) lands — repeated requests for
  the same email should be throttled (see that plan's route list).

## Out of scope

- Rate limiting this endpoint (tracked separately).
- Making the email itself list every ticket inline — the destination page
  already does that well.
