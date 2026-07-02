import { createId } from "@paralleldrive/cuid2";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Fixed-window request counters for throttling public, unauthenticated routes.
// One row per (bucketKey, windowStart); `count` is incremented via upsert.
// Postgres-backed (not in-memory/Redis) so limits hold across process
// restarts and multi-process deployments (e.g. PM2 cluster mode) — this app
// already treats Postgres as the shared store (see pg-boss for the job queue).
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    bucketKey: text("bucket_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    uniqueIndex("rate_limit_hits_bucket_window_idx").on(t.bucketKey, t.windowStart),
  ]
);
