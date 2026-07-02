# Plan: Rate limiting on public routes

**Why this matters more for a self-hosted app:** on a managed SaaS, the
platform (Vercel/Cloudflare) often throttles for you. When a team
self-hosts this on their own VPS and exposes it to the internet, the app
itself is the only defense. Right now none of the public, unauthenticated
routes have any request limit — one bad actor can flood tickets, spam
customer inboxes via the "my tickets" email, or fill the reply thread of a
ticket.

## Goal

Throttle abuse-prone public endpoints per IP (and per email where relevant),
returning `429 Too Many Requests` with a clear error, without adding an
external dependency (no Redis/Upstash requirement) — this must work
out-of-the-box for a single self-hosted instance and degrade gracefully.

## Approach

**Postgres-backed fixed-window counter**, not in-memory. Reasoning:
- Self-hosted operators may run the app with more than one Node process
  (PM2 cluster mode) or restart it frequently — in-memory counters reset on
  every restart and don't share state across processes. Postgres is already
  a hard dependency here, so it's the natural shared store (same reasoning
  as using it for the job queue via pg-boss).
- No new infra requirement (no Redis to install/document).

### Schema

New table `rate_limit_hits`:

```ts
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    bucketKey: text("bucket_key").notNull(), // e.g. "ticket_submit:203.0.113.4"
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    uniqueIndex("rate_limit_hits_bucket_window_idx").on(t.bucketKey, t.windowStart),
  ]
);
```

Fixed-window: round `now` down to the window size (e.g. nearest 10-minute
boundary) to form `windowStart`; `UPSERT ... ON CONFLICT (bucketKey,
windowStart) DO UPDATE SET count = count + 1 RETURNING count`. One row per
key per window. A pg-boss cron job (or the existing periodic prune worker
pattern already used for `email_events` — see
`lib/worker/handlers/email-events-prune.ts`) deletes rows older than a few
windows.

### Helper: `lib/rate-limit.ts`

```ts
export async function checkRateLimit(opts: {
  key: string;          // e.g. `ip:${ip}` or `email:${email}`
  action: string;       // e.g. "ticket_submit"
  limit: number;        // max hits per window
  windowMinutes: number;
}): Promise<{ allowed: boolean; remaining: number }>
```

Internally builds `bucketKey = ${action}:${key}`, upserts the counter row
for the current window, returns `allowed: count <= limit`.

### Getting the client IP

Next.js on a typical self-hosted deploy (behind Nginx/Caddy per the README)
needs `x-forwarded-for`. Add a small `getClientIp(request: NextRequest)`
helper in `lib/rate-limit.ts` that reads `x-forwarded-for` (first entry) and
falls back to `request.headers.get("x-real-ip")`, then `"unknown"`. Document
in the README that a reverse proxy must set `X-Forwarded-For` for this to
work correctly (most guides already tell operators to do this for
`NEXT_PUBLIC_APP_URL` correctness).

## Where to apply it

| Route | Key | Suggested limit |
|---|---|---|
| `POST /api/tickets` (submit ticket) | IP | 5 / 10 min |
| `POST /api/tickets/[id]/comments` (customer reply, token-based) | IP | 20 / 10 min |
| `POST /api/tickets/[id]/close`, `/reopen` (customer) | IP | 20 / 10 min |
| `POST /api/tickets/mine/send` | IP **and** email | 5 / 10 min each |
| `POST /api/webhooks/email` | skip — already gated by a shared secret (`EMAIL_WEBHOOK_SECRET`), not public-facing in the same sense |
| Better Auth magic-link request | n/a — **already rate-limited by better-auth itself** (built-in `rate-limiter` in `node_modules/better-auth/dist/api/rate-limiter`, on by default); no work needed here, just confirm it's not disabled in `lib/auth.ts` |

Each route: check the limit **before** doing any DB writes; on rejection
return `NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })`.
Do not leak the exact limit/remaining count to unauthenticated callers
(minor info leak, not worth exposing).

## Task checklist

- [ ] `db/schema/rate-limit.ts` — `rateLimitHits` table
- [ ] `pnpm db:generate` + review + `pnpm db:migrate`
- [ ] `lib/rate-limit.ts` — `checkRateLimit()` + `getClientIp()`
- [ ] Apply to the 4 routes in the table above
- [ ] Prune job for old `rate_limit_hits` rows (mirror
      `lib/worker/handlers/email-events-prune.ts`, register in
      `lib/worker/boss.ts` the same way)
- [ ] Confirm better-auth's built-in rate limiter is active (no
      `rateLimit: { enabled: false }` in `lib/auth.ts`)
- [ ] Manual test: script 6 rapid `POST /api/tickets` from the same IP,
      confirm the 6th gets `429`

## Out of scope

- Per-user (agent/admin) rate limiting — internal authenticated users are
  trusted; only public/customer-facing routes are in scope.
- CAPTCHA — a heavier addition; rate limiting is the first line of defense,
  CAPTCHA can be a later doc if abuse continues despite limits.
- Distributed rate limiting across multiple *separate* deployments — out of
  scope for a single self-hosted instance.
