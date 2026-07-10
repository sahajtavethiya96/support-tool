import { eq } from "drizzle-orm";
import { cache } from "react";
import { ADMIN_ROLE } from "@/config/platform";
import { user } from "@/db/schema";
import { db } from "@/lib/db";

/**
 * First-run setup is "complete" once at least one admin user exists. This is
 * the signal that gates the `/setup` wizard and the public `/api/setup`
 * endpoint — both self-disable the moment an admin is in the database, so the
 * unauthenticated bootstrap path can never be used to mint a second admin on a
 * live install.
 *
 * `cache()` memoizes the lookup per-request so the multiple call sites (page
 * redirect guards + the API route) share one query.
 */
export const isSetupComplete = cache(async (): Promise<boolean> => {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, ADMIN_ROLE))
    .limit(1);
  return Boolean(existing);
});
