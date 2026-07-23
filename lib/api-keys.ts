import { createHash } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, isNull } from "drizzle-orm";
import { apiKeys } from "@/db/schema";
import { db } from "@/lib/db";

export type ApiKey = typeof apiKeys.$inferSelect;

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Generates a new API key. `raw` is returned to the caller exactly once —
 * only `hash` is persisted (lib/api-keys.ts never stores the raw secret).
 * Built from cuid2 (a CSPRNG-backed generator) rather than
 * crypto.randomUUID()/Math.random(), matching this project's ID convention.
 *
 * Prefix is `stk_live_` (Support Tool Key), deliberately not `sk_live_` —
 * that's Stripe's own secret-key format, and reusing it makes every
 * placeholder example in these docs trip GitHub's push-protection secret
 * scanner as a false-positive "Stripe API key" match.
 */
export function generateApiKey(): {
  raw: string;
  prefix: string;
  hash: string;
} {
  const raw = `stk_live_${createId()}${createId()}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashKey(raw) };
}

export async function createApiKey(input: {
  name: string;
  createdById: string;
  createdByName: string;
  portalUrlTemplate?: string | null;
}): Promise<{ record: ApiKey; rawKey: string }> {
  const { raw, prefix, hash } = generateApiKey();
  const [record] = await db
    .insert(apiKeys)
    .values({
      id: createId(),
      name: input.name,
      keyPrefix: prefix,
      keyHash: hash,
      createdById: input.createdById,
      createdByName: input.createdByName,
      portalUrlTemplate: input.portalUrlTemplate ?? null,
      createdAt: new Date(),
    })
    .returning();
  return { record, rawKey: raw };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
}

/** Partial update — only fields present in `updates` are changed. */
export async function updateApiKey(
  id: string,
  updates: { name?: string; portalUrlTemplate?: string | null }
): Promise<ApiKey | undefined> {
  if (Object.keys(updates).length === 0) {
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    return row;
  }
  const [row] = await db
    .update(apiKeys)
    .set(updates)
    .where(eq(apiKeys.id, id))
    .returning();
  return row;
}

export async function revokeApiKey(
  id: string
): Promise<{ id: string; name: string; keyPrefix: string } | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix });
  return row ?? null;
}

/** Looks up an active (non-revoked) key by its raw secret. Updates
 * `lastUsedAt` best-effort — never blocks or throws on that write. */
export async function verifyApiKey(
  raw: string
): Promise<{ id: string; name: string } | null> {
  const hash = hashKey(raw);
  const [row] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);
  if (!row || row.revokedAt) {
    return null;
  }
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch((err) => console.error("[api-keys.last-used]", err));
  return { id: row.id, name: row.name };
}
