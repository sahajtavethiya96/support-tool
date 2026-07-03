# Public API

Support Tool exposes a small REST API so your own website's backend can
create tickets without sending customers through the customer portal form.

This is a **server-to-server** API: your backend calls it with a secret API
key. Don't call it directly from a customer's browser — the key would be
exposed to anyone who opens your page's network tab.

## Authentication

Generate a key from `/admin/api-keys` (admin only). You'll see the raw key
exactly once, at creation — copy it somewhere safe immediately. Support
Tool only ever stores a hash of it, so it can't be shown to you again; if
you lose it, revoke it and create a new one.

Send it as a bearer token on every request:

```
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

A missing, invalid, or revoked key gets a `401`.

## Rate limits

100 requests per minute per key. A `429` means you've hit it — back off and
retry after a moment.

## Errors

Every error response is `{ "error": "<message>" }` with an appropriate HTTP
status (`400` validation, `401` auth, `404` not found, `429` rate limited,
`500` server error).

---

## `GET /api/v1/config`

The current valid category, priority, and status slugs — fetch this once
(cache it) to build a ticket form or interpret a `status` value, instead of
hardcoding slugs an admin could rename or reorder later. Arrays are
pre-sorted in display order (the same order agents see in the app).

```bash
curl https://support.example.com/api/v1/config \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

**Response** — `200 OK`:

```json
{
  "categories": [{ "slug": "bug", "label": "Bug", "color": "red" }],
  "priorities": [
    { "slug": "normal", "label": "Normal", "color": "slate", "isDefault": true }
  ],
  "statuses": [
    {
      "slug": "open",
      "label": "Open",
      "color": "blue",
      "isDefault": true,
      "isClosedState": false
    }
  ]
}
```

## `POST /api/v1/tickets`

Create a ticket.

**Body** (JSON):

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Customer's name, 2–100 characters |
| `email` | Yes | Customer's email |
| `subject` | Yes | 5–200 characters |
| `description` | Yes | 10–5000 characters |
| `category` | Yes | Must match a category slug configured in `/admin/ticket-config` |
| `priority` | No | Must match a priority slug if given; falls back to the platform's default priority |

```bash
curl -X POST https://support.example.com/api/v1/tickets \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Cannot log in",
    "description": "I get an error when I try to sign in.",
    "category": "bug"
  }'
```

```js
await fetch("https://support.example.com/api/v1/tickets", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Cannot log in",
    description: "I get an error when I try to sign in.",
    category: "bug",
  }),
});
```

**Response** — `201 Created`:

```json
{
  "id": "cku1a2b3c4d5e6f",
  "ticketNumber": 1042,
  "status": "open",
  "portalUrl": "https://support.example.com/ticket/cku1a2b3c4d5e6f?token=..."
}
```

The customer also gets the standard confirmation email, which links to the
same `portalUrl` — they can reply and track the ticket there without any
extra work on your end. Fetch `GET /api/v1/config` to get the current
`category`/`priority` slugs — the set is deployment-specific and
admin-configurable, so don't hardcode it.

## `GET /api/v1/tickets/:id`

Look up a ticket's current status — e.g. to show "In Progress" on your own
site without redirecting to the portal.

```bash
curl https://support.example.com/api/v1/tickets/cku1a2b3c4d5e6f \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

**Response** — `200 OK`:

```json
{
  "id": "cku1a2b3c4d5e6f",
  "ticketNumber": 1042,
  "subject": "Cannot log in",
  "status": "in_progress",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-02T09:15:00.000Z"
}
```

`404` if the ticket doesn't exist. Any active API key can read any ticket
on your instance — there's no per-key scoping, since a self-hosted
deployment belongs to one owner.

## `GET /api/v1/tickets/:id/comments`

Read the conversation thread — e.g. to show ticket replies on your own
site, not just its status.

```bash
curl https://support.example.com/api/v1/tickets/cku1a2b3c4d5e6f/comments \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

**Response** — `200 OK`:

```json
{
  "comments": [
    {
      "id": "ckv2b3c4d5e6f7g",
      "authorName": "Alex (Support)",
      "authorRole": "agent",
      "content": "Thanks for reaching out — looking into this now.",
      "createdAt": "2026-07-01T11:30:00.000Z"
    }
  ]
}
```

Only public replies — internal agent notes are never returned, same rule
the customer portal itself enforces. `content` is always plain text
(replies are stored as rich text internally; this flattens formatting away
rather than exposing Support Tool's internal document format). `404` if
the ticket doesn't exist.

## `GET /api/v1/tickets?email=`

List a customer's tickets, most recent first — e.g. to show "Your Tickets"
on your own site. Returns up to 50; there's no pagination yet.

```bash
curl "https://support.example.com/api/v1/tickets?email=jane@example.com" \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

**Response** — `200 OK`:

```json
{
  "tickets": [
    {
      "id": "cku1a2b3c4d5e6f",
      "ticketNumber": 1042,
      "subject": "Cannot log in",
      "status": "in_progress",
      "createdAt": "2026-07-01T10:00:00.000Z",
      "updatedAt": "2026-07-02T09:15:00.000Z"
    }
  ]
}
```

`400` if `email` is missing. Matches on an exact, case-sensitive equality
against the email the ticket was created with (same as everywhere else in
the app) — an empty `tickets` array just means no match, not an error.

---

## What's not supported yet

- **File attachments** — create the ticket via the API, then have the
  customer attach files from the portal link if needed.
- **Posting additional replies** through the API (continuing a
  conversation from your own widget).
- **Webhooks** — there's no way yet to get notified when an agent replies
  or a ticket's status changes. Poll `GET /api/v1/tickets/:id/comments` if
  you need that today.
- **A client-side/embeddable widget.** The API is designed to be called
  from your backend, not a browser.
