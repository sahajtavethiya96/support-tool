# Plan: Real-time ticket updates (Pusher Channels)

**Decision:** real-time only, no polling fallback — the team explicitly chose
this over polling after being told the tradeoff (every self-hoster who wants
this feature must configure Pusher Channels; without it, the affected pages
just behave as they do today — manual refresh, nothing broken).

## Why this needs a new integration

The app already has **Pusher Beams** (`@pusher/push-notifications-server`/`-web`,
`lib/push.ts`) — but Beams is a different product. It delivers OS-level push
notifications to a device via the browser Push API; it has no mechanism to
push live data into a page that's already open in a tab. Making the ticket
list and an open ticket detail page update themselves needs **Pusher
Channels** — a separate pub/sub product, separate credentials, separate SDKs
(`pusher` server / `pusher-js` client, not yet installed).

## Goal

1. Agent is on `/tickets` (the list) → a new ticket is submitted by a
   customer → the list updates itself, no manual refresh.
2. Agent is on `/tickets/{id}` (detail) → anyone posts a new comment on that
   ticket (customer reply, another agent's reply, an internal note) → the
   page updates itself, no manual refresh. Feels like live chat.

~~Scope is agent-side only for now~~ — **extended to the customer portal
too, same session** (see Addendum at the bottom). Original agent-only scope
kept below for history; the addendum documents what changed and why.

## Env vars (all optional — feature no-ops without them, same philosophy as Beams)

| Var | Where | Notes |
|-----|-------|-------|
| `PUSHER_APP_ID` | server only | |
| `NEXT_PUBLIC_PUSHER_KEY` | public | baked in at build time, like the Beams instance id |
| `PUSHER_SECRET` | server only | |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | public | e.g. `us2`, `eu`, `ap1` |

Add to `lib/env.ts` (all via the existing `optionalString` helper),
`.env.example`, and the README's env var table.

## Server: `lib/realtime.ts` (new)

Mirrors `lib/push.ts`'s shape exactly — lazy client, `isRealtimeConfigured()`,
best-effort publish functions that never throw to the caller:

```ts
import PusherServer from "pusher";

let client: PusherServer | null = null;
function getClient(): PusherServer | null {
  if (client) return client;
  const { PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER } = env;
  if (!(PUSHER_APP_ID && NEXT_PUBLIC_PUSHER_KEY && PUSHER_SECRET && NEXT_PUBLIC_PUSHER_CLUSTER)) return null;
  client = new PusherServer({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  return client;
}

export function isRealtimeConfigured(): boolean {
  return getClient() !== null;
}

export async function publishTicketCreated(): Promise<void> {
  await getClient()?.trigger("private-tickets", "ticket.created", {});
}

export async function publishTicketCommentCreated(ticketId: string): Promise<void> {
  await getClient()?.trigger(`private-ticket-${ticketId}`, "comment.created", {});
}
```

Payloads are deliberately empty/minimal — the client just triggers
`router.refresh()` on receipt rather than trying to render Pusher-delivered
data directly. Keeps this simple and avoids duplicating serialization/access
rules (e.g. internal-note visibility) in a second code path; the RSC refetch
re-runs the exact same server-side query + auth check that already backs the
page.

## Server: channel auth endpoint

`app/api/pusher/auth/route.ts` (new) — private channels require the
subscribing client to prove authorization. Mirrors `beams-auth/route.ts`'s
shape but Pusher's channel-auth protocol is a `POST` with
`socket_id` + `channel_name` in the body (not a `GET`):

```ts
export async function POST(request: NextRequest) {
  const me = getSessionUserFromRequest(request); // agent/admin only — same guard as every agent API route
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const form = await request.formData(); // pusher-js posts form-encoded by default
  const socketId = form.get("socket_id") as string;
  const channel = form.get("channel_name") as string;

  const auth = authorizeChannel(socketId, channel); // wraps pusher.authorizeChannel(...)
  if (!auth) return NextResponse.json({ error: "Not configured." }, { status: 404 });
  return NextResponse.json(auth);
}
```

No per-ticket access restriction beyond "is an agent/admin" — the app
already lets any agent/admin view any ticket's detail page (no assignment-only
restriction elsewhere), so authorizing any agent/admin for any
`private-ticket-*` channel is consistent with existing access rules.

## Client: `lib/pusher-browser.ts` (new)

Lazy singleton `getPusherClient()`, dynamic-imports `pusher-js` (same
dynamic-import-to-keep-it-out-of-the-main-bundle pattern as `push-init.tsx`
does for `@pusher/push-notifications-web`). Configures
`channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" }`.

## Client: two small subscriber components

- `components/agent/tickets-list-realtime.tsx` — mounted in
  `app/(agent)/tickets/page.tsx`. Subscribes to `private-tickets`, calls
  `router.refresh()` on `ticket.created`. Renders nothing.
- `components/agent/ticket-detail-realtime.tsx` — mounted in
  `app/(agent)/tickets/[ticketId]/page.tsx`, takes `ticketId` prop.
  Subscribes to `private-ticket-{ticketId}`, calls `router.refresh()` on
  `comment.created`. Renders nothing.

Both no-op (render nothing, subscribe to nothing) when
`NEXT_PUBLIC_PUSHER_KEY` isn't set — same graceful-absence pattern as
`PushInit`.

`router.refresh()` re-runs the Suspense-wrapped server components on both
pages (`TicketsResults`, the ticket detail page body) — a soft RSC refetch,
not a hard navigation, so no full-page flash.

## Publish call sites

- `app/api/tickets/route.ts` — `POST` handler, right after the existing
  in-app-notification block (near the end, before the final
  `return NextResponse.json(...)`): `await publishTicketCreated().catch((err) => console.error("[realtime.ticket_created]", err));`
- `app/api/tickets/[id]/comments/route.ts` — `POST` handler, right after
  the `ticketActivity` insert, **unconditionally** (not just for customer
  replies — any comment, including internal notes and other agents'
  replies, should live-update anyone currently viewing that ticket):
  `await publishTicketCommentCreated(ticketId).catch((err) => console.error("[realtime.comment_created]", err));`

Both are fire-and-forget, `.catch()`-guarded, never block the response —
same convention as every other notification call in this codebase.

## Task checklist

- [ ] `pnpm add pusher pusher-js`
- [ ] `lib/env.ts` — 4 new optional vars
- [ ] `.env.example` + README env table — document them
- [ ] `lib/realtime.ts` — server publish helpers
- [ ] `app/api/pusher/auth/route.ts` — channel auth endpoint
- [ ] `lib/pusher-browser.ts` — client singleton
- [ ] `components/agent/tickets-list-realtime.tsx`
- [ ] `components/agent/ticket-detail-realtime.tsx`
- [ ] Wire both into their respective pages
- [ ] Wire both publish calls into their respective API routes
- [ ] New reference doc `docs/realtime-updates.md` (mirror
      `docs/in-app-notifications.md`'s structure) once shipped
- [ ] Manual test: two browser sessions (or one + curl a ticket creation) —
      confirm the list updates in session A when a ticket is created from
      session B, and confirm an open ticket detail page updates when a
      reply is posted from another session
- [ ] Confirm graceful no-op end to end when the four env vars are absent
      (default dev setup) — no errors, pages just behave as today

## Out of scope

- Typing indicators / presence ("agent is replying…") — a further
  live-chat enhancement, not requested, would reuse the same channels
- Optimistic client-side append of the new comment's actual content
  (avoiding a full RSC refetch) — `router.refresh()` is simple and
  sufficiently smooth for a first version; revisit if it feels janky

## Addendum: extended to the customer portal (same session)

Right after shipping the agent-only version, a real bug surfaced during
manual testing that reshaped this: `POST /api/tickets/[id]/comments`
checked for a valid agent **session** before falling back to the customer
**token** — meaning a customer reply submitted from a browser that also
happened to carry a valid agent session cookie (e.g. an agent testing their
own portal in another tab of the same profile) was silently misattributed
as an agent comment. Fixed by checking `token` first and treating it as
authoritative whenever present, since the two reply forms are mutually
exclusive by construction (only the customer form ever sends `token`).

That fix made "give the customer live updates too" the natural next step,
since it hardened exactly the token-vs-session precedence logic this needed
anyway. Changes on top of everything above:

- **`proxy.ts`** — `/api/pusher/*` removed from the middleware matcher. It
  can no longer be agent/admin-only at the middleware layer, because a
  customer (no session at all) must also be able to reach it.
- **`app/api/pusher/auth/route.ts`** — rewritten to do its own session
  lookup (`auth.api.getSession`, not the header-based
  `requireAgentFromRequest`) and branch per channel: `private-tickets`
  stays agent/admin-only; `private-ticket-{id}` accepts *either* an
  agent/admin session *or* a `token` form field that's verified against
  that exact ticket's `customerToken` in the DB — same
  check-the-explicit-token-don't-trust-ambient-session principle as the
  comments-route fix above.
- **`lib/pusher-browser.ts`** — added `getPusherClientForCustomer(token)`,
  a second, uncached client factory (the existing `getPusherClient()` stays
  agent-only and singleton-cached) that sends `token` as an extra
  `channelAuthorization.params` field. Uncached because the customer portal
  lets someone navigate between sibling tickets, each with a different
  token — a cached singleton would authorize the wrong ticket.
- **`types/pusher-js.d.ts`** — added `channelAuthorization.params` to the
  hand-written ambient declaration (confirmed against `pusher-js`'s actual
  source, not guessed — `core/auth/channel_authorizer.ts` appends
  `authOptions.params` to the auth request's form-urlencoded body).
- **`app/(customer)/ticket/[ticketId]/ticket-realtime.tsx`** (new,
  co-located with `reply-form.tsx`/`ticket-actions.tsx` per that folder's
  existing convention) — subscribes to `private-ticket-{ticketId}` via the
  customer client, `router.refresh()` on `comment.created`. Mounted in the
  customer ticket page with the ticket's own `token`.

Net result: real two-way live chat — an agent and a customer replying back
and forth on the same ticket now see each other's messages appear without
either side refreshing.
