import { lt } from "drizzle-orm";
import type { Job } from "pg-boss";
import { rateLimitHits } from "@/db/schema";
import { db } from "@/lib/db";

export async function handleRateLimitHitsPrune(
  _jobs: Job<Record<string, never>>[]
) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(rateLimitHits).where(lt(rateLimitHits.windowStart, cutoff));
}
