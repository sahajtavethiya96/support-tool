# Plan: Public API for ticket creation

**Decision:** v1 is a **server-to-server REST API authenticated with API
keys** — an integrator's own backend calls us, never their customer's
browser directly. No CORS, no embeddable widget, no outbound webhooks in
this phase. Those are real, common asks (see "Out of scope" below) but each
one adds a distinct security surface (public/domain-scoped keys, signed
payload delivery, retry queues) — bundling them into v1 would blow up scope
for a feature nobody has asked for yet. Ship the simple, secure default
first; add the rest only if a self-hoster actually needs it.

## Why this needs planning before code

This is the first feature in the app that authenticates a caller as
*neither* an agent/admin session *nor* a customer ticket token — it's a
third identity type ("this request is trusted by API key X"). Every
existing public-facing route (`POST /api/tickets`, the comments route) was
built assuming a human is either logged in or holding a token for one
specific ticket. An API key can create *any number* of tickets and, if
compromised, do so at speed — so the rate-limit story, the key-storage
story, and the revocation story all matter more here than the "add a
feature" work itself.

## Goal

1. A self-hoster has their own website (marketing site, SaaS app, whatever)
   with its own "Contact Support" form. Their backend calls our API with a
   secret key instead of sending the customer through our customer portal
   form. We create the ticket exactly as if it came through the portal —
   same validation, same category/priority defaults, same confirmation
   email to the customer (with their normal portal link so they can follow
   up on the existing UI), same agent notifications.
2. An admin can generate, name, view (prefix only, once), and revoke API
   keys from `/admin/api-keys` — same trust level as `/admin/users`.
3. Every ticket created via the API is visibly distinguishable from a
   portal-submitted one in the ticket's Activity feed, so agents aren't
   confused about where it came from.
4. A leaked/compromised key can be revoked instantly and stops working on
   the next request — no redeploy, no rotation ceremony.

## Data model changes

### New table: `db/schema/api-keys.ts`

```ts
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(), // cuid2
  name: text("name").notNull(), // admin-chosen label, e.g. "Marketing site"
  keyPrefix: text("key_prefix").notNull(), // first 12 chars, shown in the UI forever
  keyHash: text("key_hash").notNull().unique(), // sha256 of the full key — the full key is never stored
  createdById: text("created_by_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdByName: text("created_by_name").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"), // soft revoke — keep the row for audit history
  createdAt: timestamp("created_at").notNull(),
});
```

Soft revoke (not delete) so `tickets.apiKeyId` below never dangles and the
audit log stays meaningful after a key is retired.

### `db/schema/tickets.ts` — two new columns

```ts
source: text("source").notNull().default("portal"), // "portal" | "api"
apiKeyId: text("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
```

`source` is the one piece of this plan that's worth a small amount of
future-proofing: cheap to add now, would be an annoying backfill later if
an admin ever wants to filter "which tickets came from the API" (natural
extension of the range/status/priority filters already on `/tickets`) —
but building that filter UI is explicitly **not** part of this plan.

## Shared logic: `lib/tickets/create-ticket.ts` (new — refactor, not duplication)

`app/api/tickets/route.ts`'s `POST` handler currently does validation →
attachment upload → DB insert → activity log → email → in-app notify →
push → realtime publish, all inline. The new `POST /api/v1/tickets` needs
the same pipeline minus attachments and minus its own copy of every
validation rule (category must be a real slug, description 10–5000 chars,
etc. — those rules must never drift between the two entry points).

Extract everything from "validated input" onward into:

```ts
interface TicketSubmission {
  name: string;
  email: string;
  subject: string;
  description: string;
  category: string;
  priority?: string; // optional — falls back to the platform default
  source: "portal" | "api";
  apiKeyId?: string;
  attachments?: Array<{ id: string; filename: string; storageKey: string; fileSize: number; mimeType: string }>;
}

export async function createTicketFromSubmission(input: TicketSubmission): Promise<{ id: string; ticketNumber: number; customerToken: string }>
```

Contains: the `tickets` insert, attachment rows, `ticketActivity` insert,
email enqueue, agent notifications, push, and `publishTicketCreated()` —
verbatim from the current route, parameterized. Both routes become thin:
parse+validate their own input shape (multipart vs. JSON), call the shared
function, map the result to their own response shape.

`app/api/tickets/route.ts` keeps its exact current behavior and response
shape — this refactor must be invisible to the existing customer portal.

## Auth: `lib/api-keys.ts` + `lib/api-auth.ts` (new)

```ts
// lib/api-keys.ts
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `sk_live_${createId()}${createId()}`; // cuid2 is CSPRNG-backed — no crypto.randomUUID/Math.random per project convention
  return { raw, prefix: raw.slice(0, 16), hash: sha256(raw) };
}

export async function verifyApiKey(raw: string): Promise<{ id: string; name: string } | null> {
  const hash = sha256(raw);
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).limit(1);
  if (!row || row.revokedAt) return null;
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {}); // best-effort, non-blocking
  return { id: row.id, name: row.name };
}
```

```ts
// lib/api-auth.ts — same throw-a-Response pattern as requireAdminFromRequest
export async function requireApiKey(request: Request): Promise<{ id: string; name: string }> {
  const header = request.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!raw) throw jsonError(401, "Missing API key.");
  const key = await verifyApiKey(raw);
  if (!key) throw jsonError(401, "Invalid or revoked API key.");
  return key;
}
```

`sha256`, not bcrypt: API keys are already high-entropy (two concatenated
cuid2s), unlike a human password — the threat model is "don't store the
raw secret," not "resist offline brute force of a low-entropy input." A
fast hash is correct here and is what Stripe/GitHub/etc. do for API
tokens.

The raw key is shown to the admin **exactly once**, at creation, in the
create-key dialog — never retrievable again, matching every SaaS API-key
UX convention. Only `keyPrefix` (e.g. `sk_live_a1b2c3d4`) is stored
visibly, so the admin can identify *which* key is which in a list without
the full secret ever touching the database in plaintext or being
re-displayable.

## New routes

### `POST /api/v1/tickets`

```
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Cannot log in",
  "description": "I get an error when I try to sign in.",
  "category": "bug",       // optional — falls back to the platform default category
  "priority": "high"       // optional — falls back to the platform default priority
}
```

Rate limited **per API key**, not per IP (server-to-server traffic often
shares infra IPs): `checkRateLimit({ action: "api_ticket_create", key: apiKeyId, limit: 100, windowMinutes: 1 })`.
100/min is a generous starting default — revisit if a real self-hoster
needs more; the limiter itself needs no changes, `action` is just a new
bucket name.

```
201 Created
{
  "id": "cuid...",
  "ticketNumber": 1042,
  "status": "open",
  "portalUrl": "https://support.example.com/ticket/cuid...?token=..."
}
```

`portalUrl` reuses the exact URL shape already built in
`app/api/tickets/route.ts` (`${NEXT_PUBLIC_APP_URL}/ticket/${id}?token=${customerToken}`)
— the same link the confirmation email sends — so the integrator can, if
they want, redirect the customer straight into our existing portal to
track replies, with zero new UI to build.

Errors: `{ error: string }`, matching every other route in the app.
`401` missing/invalid/revoked key, `429` rate limited, `400` validation
(identical messages to the portal route, since it's the same validation
code).

### `GET /api/v1/tickets/:id`

Ticket status lookup for an integrator that wants to show "your ticket is
in progress" on their own site without redirecting to our portal. Any
valid (non-revoked) key can read any ticket — this is a single-tenant,
self-hosted deployment, so there's no cross-tenant isolation concern the
way there would be in a multi-tenant SaaS; every key belongs to the same
instance owner.

```
200 OK
{ "id": "...", "ticketNumber": 1042, "subject": "...", "status": "in_progress", "createdAt": "...", "updatedAt": "..." }
```

## Admin UI: `/admin/api-keys`

Follows the existing `admin/ticket-config` page shape (server component
page + `Suspense` + `_components/`):

- `app/(admin)/admin/api-keys/page.tsx` — table: Name, Key prefix, Created
  by, Last used, Status (Active/Revoked), created date. `requireAdmin()`
  page guard, same as every other `/admin/*` page.
- `app/(admin)/admin/api-keys/loading.tsx` — skeleton, mirrors
  `ticket-config/loading.tsx`.
- `_components/create-api-key-dialog.tsx` — name input → `POST
  /api/admin/api-keys` → shows the raw key **once** in a copyable
  monospace field with a "Copy" button and an explicit "You won't be able
  to see this again" warning, `shadcn Dialog` (never `window.confirm`).
- `_components/revoke-api-key-dialog.tsx` — confirmation dialog before
  `DELETE /api/admin/api-keys/:id` (soft revoke: sets `revokedAt`, doesn't
  delete the row).
- `app/api/admin/api-keys/route.ts` (`GET` list, `POST` create) +
  `app/api/admin/api-keys/[id]/route.ts` (`DELETE` revoke) — all
  `requireAdminFromRequest`, same pattern as `app/api/admin/settings/route.ts`.
- `components/agent/sidebar.tsx` — new `adminItems` entry:
  `{ href: "/admin/api-keys", label: "API Keys", icon: KeyIcon }`.

## Activity attribution

`ticketActivity` rows from an API-created ticket use
`actorRole: "api"`, `actorName: "API: {apiKeyName}"` (e.g. `"API:
Marketing site"`) instead of `"customer"` — same `ticket_created` action,
just distinguishable in the Activity feed so an agent immediately sees
where the ticket came from without needing the new `source` column
surfaced anywhere in the UI yet.

## Docs

- `docs/api.md` (new) — the actual external-developer-facing reference:
  auth header, both endpoints, curl + JS `fetch` examples, error shapes,
  rate limit, and an explicit "attachments and replies aren't supported
  yet" note. This is the one doc in the repo meant for people who aren't
  touching this codebase — link it from the README once shipped.
- `docs/database-schema.md` — document `api_keys` and the two new
  `tickets` columns.
- `docs/permission-model.md` — one row: "Manage API keys — No / No / Yes"
  (admin only, same as user role management).

## Task checklist

- [ ] `db/schema/api-keys.ts` + add to `db/schema/index.ts` barrel
- [ ] `tickets.source` + `tickets.apiKeyId` columns
- [ ] Generate + review + apply migration
- [ ] `lib/api-keys.ts` — generate/hash/verify/create/list/revoke
- [ ] `lib/api-auth.ts` — `requireApiKey`
- [ ] `lib/tickets/create-ticket.ts` — extract shared submission pipeline
- [ ] Refactor `app/api/tickets/route.ts` to call the shared function
      (manual regression check: portal ticket submission still works
      identically — email, notifications, realtime, attachment rollback
      on failure)
- [ ] `app/api/v1/tickets/route.ts` — `POST` create
- [ ] `app/api/v1/tickets/[id]/route.ts` — `GET` status
- [ ] `app/api/admin/api-keys/route.ts` + `[id]/route.ts`
- [ ] `/admin/api-keys` page + dialogs + sidebar nav entry
- [ ] `docs/api.md`, `docs/database-schema.md`, `docs/permission-model.md`
      updates
- [ ] Manual test: create a key, `curl` a ticket into existence, confirm
      it shows up on `/tickets` with correct Activity attribution, confirm
      the customer gets the same confirmation email as a portal ticket,
      revoke the key, confirm the same `curl` now gets `401`

## Out of scope (deliberately deferred, not forgotten)

- **File attachments via the API** — JSON-only for v1. Real demand for
  this would justify the multipart-handling work; no sense building it
  speculatively.
- **`POST /api/v1/tickets/:id/replies`** — letting an integrator's own
  widget relay follow-up customer messages into an existing ticket. Same
  auth/rate-limit shape as ticket creation, natural fast-follow once v1 is
  proven, deliberately left out to keep this plan's first cut small.
- **Outbound webhooks** (notify the integrator's system when an agent
  replies or the status changes) — a genuinely useful, genuinely bigger
  feature: needs a webhook URL per key, HMAC request signing, and a
  retry/backoff story (pg-boss is already in the stack for this). Worth
  its own plan doc if/when it's actually requested.
- **Public/domain-scoped keys + CORS + an embeddable JS widget** for
  pure client-side integration (no backend required on the integrator's
  side). This is a materially different trust model — a key usable
  directly from a browser must be safe to expose publicly, which server
  secret keys are not. Would need its own key *type*, not a flag on the
  existing one.
- **Per-key scopes/permissions** (e.g. a key that can only create tickets,
  not read them) — v1 keys are all-or-nothing (create + read). Revisit if
  a self-hoster actually wants to hand a narrower key to a third party.
- **Per-key configurable rate limits** — v1 ships one fixed default for
  every key.
