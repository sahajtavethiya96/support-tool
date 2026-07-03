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
 */
export function generateApiKey(): {
  raw: string;
  prefix: string;
  hash: string;
} {
  const raw = `sk_live_${createId()}${createId()}`;
  return { raw, prefix: raw.slice(0, 16), hash: hashKey(raw) };
}

export async function createApiKey(input: {
  name: string;
  createdById: string;
  createdByName: string;
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
      createdAt: new Date(),
    })
    .returning();
  return { record, rawKey: raw };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return Boolean(row);
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
