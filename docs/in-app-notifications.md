# In-App Notifications (Agents)

Agents are notified **inside the app** — not by email — when something needs their
attention. Notifications appear in the bell menu in the top bar, with an unread count.

## Events

| Event | Type | Recipients |
|-------|------|------------|
| New ticket submitted | `ticket_created` | All active (non-banned) agents and admins — a brand-new ticket has no assigned agent yet |
| Customer replied to a ticket | `customer_replied` | Assigned agent if the ticket is assigned; otherwise all active (non-banned) agents and admins |

> This zero-config routing means a solo self-hoster always gets the reply, teams only
> ping the owner of an assigned ticket, and unowned tickets reach everyone.

## Data model

`notifications` table (`db/schema/notifications.ts`):

| Column | Notes |
|--------|-------|
| `id` | Primary key |
| `userId` | Recipient — FK `user.id`, `ON DELETE CASCADE` |
| `type` | Event type, e.g. `customer_replied` |
| `ticketId` | Related ticket — FK `tickets.id`, `ON DELETE CASCADE` (nullable) |
| `ticketNumber` | Denormalised for display |
| `title` / `body` | Display text (body is a short preview) |
| `isRead` | Unread by default |
| `createdAt` | Timestamp |

Indexed on `userId` and `(userId, isRead)` for fast unread lookups.

## API

All routes are agent/admin only (enforced by `proxy.ts`; identity read from the
`x-user-id` header it injects).

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/notifications` | Recent notifications + `unreadCount` for the current agent |
| `POST` | `/api/notifications/read` | Body `{ id }` marks one read; empty body marks all read |

Helpers live in `lib/notifications.ts` (`createNotifications`, `listNotifications`,
`getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`).

## UI

`components/agent/notification-bell.tsx`, mounted in the agent/admin top bar
(`components/agent/topbar.tsx`):

- Bell icon with an unread badge.
- Polls `GET /api/notifications` every 30s for the unread count (and refreshes on open).
- Clicking a notification marks it read and navigates to `/tickets/{ticketId}`.
- "Mark all read" clears the badge.

A lightweight poll keeps the in-app bell simple and reliable for self-hosters. For
true OS-level delivery (even when the app is closed), enable **Pusher Beams** below.

## Browser / OS push (Pusher Beams) — optional

When configured, agents also get **OS-level push notifications** (desktop/mobile) on a
customer reply — even when the app or tab is closed. If not configured, everything
falls back to the in-app bell with zero setup.

**Enable it:**

1. Create a Beams instance at https://dashboard.pusher.com → Beams.
2. Set env vars:
   - `NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID` — the instance id (read by the browser;
     **baked in at build time** — for Docker pass it as a build arg, see README).
   - `PUSHER_BEAMS_SECRET_KEY` — the secret key (server only).

**How it works:**

| Piece | File |
|-------|------|
| Server publish + token signing | `lib/push.ts` (`publishPushToUsers`, `generateBeamsToken`, `isPushConfigured`) |
| Token auth endpoint | `app/api/notifications/beams-auth/route.ts` — issues a Beams device token, only for the signed-in agent's own id |
| Service worker | `public/service-worker.js` — imports the Beams SW (handles push while closed) |
| Client registration | `components/agent/push-init.tsx` — mounted in the agent/admin layouts; requests permission and binds the device to the agent's user id |
| Trigger | `tickets` route (new ticket) and `comments` route (customer reply) each call `publishPushToUsers(...)` right after `createNotifications(...)` |

- Uses Beams **"Authenticated Users"** mode — devices are associated with the agent's
  user id, so the same routing (assigned agent / all agents) applies to push.
- The publish is best-effort and a **no-op when Beams isn't configured** — it never
  blocks saving the customer's reply.
- Web push requires a **secure context** (HTTPS in production; `localhost` is exempt).
- Signing in as a different agent on the same browser reassigns the device automatically
  (`setUserId` is called on each layout mount).

## Creating a notification

```ts
import { createNotifications } from "@/lib/notifications";

await createNotifications(recipientUserIds, {
  type: "customer_replied",
  title: `${customerName} replied to #${ticketNumber}`,
  body: replyText.slice(0, 200),
  ticketId,
  ticketNumber,
});
```

Notification creation is best-effort — failures are logged, never thrown, so they
don't block the underlying action (e.g. saving the customer's reply).
