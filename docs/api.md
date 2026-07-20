# Public API

Support Tool exposes a small REST API so your own website's backend can
create tickets without sending customers through the customer portal form.

> **Interactive docs & machine-readable contract.** Admins get an
> interactive reference (rendered by Scalar, with a built-in "Test Request"
> client) at `/admin/api-keys/docs`. The canonical contract is the OpenAPI
> 3.1 spec in `lib/openapi-spec.ts`, downloadable at
> `GET /api/admin/api-keys/openapi` — import it into Postman or any other
> API tooling. When the API changes, update the spec and this document
> together.

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
Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx
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
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
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
  ],
  "customFields": [
    {
      "key": "order_id",
      "label": "Order ID",
      "type": "text",
      "required": false
    },
    {
      "key": "plan",
      "label": "Plan",
      "type": "select",
      "options": ["Free", "Pro", "Enterprise"],
      "required": true
    }
  ]
}
```

`customFields` lists whatever an admin has configured at `/admin/custom-fields`
(empty array if none). `type` is one of `text`, `number`, `date`, `checkbox`,
`select`; `options` is only present for `select`.

## `POST /api/v1/tickets`

Create a ticket.

**Body** (JSON):

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Customer's name, 2–100 characters |
| `email` | Yes | Customer's email |
| `subject` | Yes | 5–200 characters |
| `description` | Yes | 10–5000 characters (counted after formatting is stripped), see note below |
| `descriptionFormat` | No | `"text"` (default) or `"html"` |
| `category` | Yes | Must match a category slug configured in `/admin/ticket-config` |
| `priority` | No | Must match a priority slug if given; falls back to the platform's default priority |
| `customFields` | No | `{ "<key>": <value> }` map — see below |

> **Custom fields.** Admins can define extra fields at `/admin/custom-fields`
> (text, number, date, checkbox, or select) — fetch `GET /api/v1/config` to
> see what's configured. Send matching values as a flat object keyed by each
> field's `key`: strings for `text`/`date` (date as `YYYY-MM-DD`), a number
> for `number`, `true`/`false` for `checkbox`, and one of the field's
> `options` for `select`. **Required fields are only enforced if you include
> the `customFields` object at all** — omit it entirely and ticket creation
> proceeds without touching custom fields (so adding a required field later
> never breaks an integration that doesn't know about it yet); include it
> and any required field left out returns a `400`.

> **Editor-agnostic by design.** Ticket descriptions are rich text
> internally (same as replies), but you don't need to speak our internal
> format to submit one. Send plain text (the default), or set
> `descriptionFormat: "html"` and send whatever your own editor exports —
> Quill, TipTap, TinyMCE, CKEditor, Lexical, Slate, all of them can export
> HTML. We convert it server-side, safely: your HTML is parsed strictly
> through Support Tool's own schema, so any tag or attribute it doesn't
> recognize (scripts, event handlers, unknown elements) is simply dropped,
> never stored or trusted as-is. If your form is a plain textarea, just
> send plain text — no conversion needed either way.

```bash
curl -X POST https://support.example.com/api/v1/tickets \
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Cannot log in",
    "description": "I get an error when I try to sign in.",
    "category": "bug",
    "customFields": { "order_id": "A-1042", "plan": "Pro" }
  }'
```

```js
// Plain text (default) — descriptionFormat omitted
await fetch("https://support.example.com/api/v1/tickets", {
  method: "POST",
  headers: {
    Authorization: "Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
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

// HTML from your own editor
await fetch("https://support.example.com/api/v1/tickets", {
  method: "POST",
  headers: {
    Authorization: "Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Cannot log in",
    description: "<p>I get an error when I try to sign in.</p><p><strong>It started this morning.</strong></p>",
    descriptionFormat: "html",
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
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
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

This endpoint also returns `category`, `priority`, `customerName`,
`customerEmail`, `description`/`descriptionHtml`, `attachments`, and
`customFields` (a flat `{ "<key>": <value> }` map, decoded to native JSON
types — number/boolean/string — matching what you'd send on create); they're
omitted above for brevity.

`404` if the ticket doesn't exist. Any active API key can read any ticket
on your instance — there's no per-key scoping, since a self-hosted
deployment belongs to one owner.

## `GET /api/v1/tickets/:id/comments`

Read the conversation thread — e.g. to show ticket replies on your own
site, not just its status.

```bash
curl https://support.example.com/api/v1/tickets/cku1a2b3c4d5e6f/comments \
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
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
      "html": "<p>Thanks for reaching out — looking into this now.</p>",
      "createdAt": "2026-07-01T11:30:00.000Z"
    }
  ]
}
```

Only public replies — internal agent notes are never returned, same rule
the customer portal itself enforces. Replies are stored as rich text
internally (bold, lists, links, etc.) — `content` is that flattened to
plain text; `html` renders the same content with formatting intact, safe
to insert into a page (it's generated from our own stored document, not
arbitrary external HTML — only tags the editor itself can produce ever
come out). Use whichever fits where you're displaying it. `404` if the
ticket doesn't exist.

## `GET /api/v1/tickets?email=`

List a customer's tickets, most recent first — e.g. to show "Your Tickets"
on your own site. Returns up to 50; there's no pagination yet.

```bash
curl "https://support.example.com/api/v1/tickets?email=jane@example.com" \
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
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
  conversation from your own widget). When this ships, expect the same
  `descriptionFormat`-style `text`/`html` input as ticket creation. In the
  meantime, `GET .../comments`' `html` field is read-only enrichment of
  *our own* replies, not something you can send back to us — if a customer
  needs to keep replying with formatting, send them the ticket's
  `portalUrl` so they use Support Tool's own editor.
- **Webhooks** — there's no way yet to get notified when an agent replies
  or a ticket's status changes. Poll `GET /api/v1/tickets/:id/comments` if
  you need that today.
- **A client-side/embeddable widget.** The API is designed to be called
  from your backend, not a browser.
