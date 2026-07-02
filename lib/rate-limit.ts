import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { rateLimitHits } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * Best-effort client IP extraction for a self-hosted deploy behind a reverse
 * proxy (Nginx/Caddy per the README). Requires the proxy to forward
 * `X-Forwarded-For`; falls back to `"unknown"` (which still rate-limits —
 * just as one shared bucket — rather than throwing).
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window rate limiter backed by Postgres (not in-memory) so limits
 * survive restarts and hold across multiple app processes. Rounds `now` down
 * to the window boundary, upserts a per-(action, key, window) counter, and
 * reports whether this request is still within the limit.
 */
export async function checkRateLimit(opts: {
  action: string;
  key: string;
  limit: number;
  windowMinutes: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const bucketKey = `${opts.action}:${opts.key}`;
  const windowMs = opts.windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimitHits)
    .values({ bucketKey, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHits.bucketKey, rateLimitHits.windowStart],
      set: { count: sql`${rateLimitHits.count} + 1` },
    })
    .returning({ count: rateLimitHits.count });

  const count = row?.count ?? 1;
  return {
    allowed: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
  };
}
