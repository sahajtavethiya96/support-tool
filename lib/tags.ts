import { createId } from "@paralleldrive/cuid2";
import { asc, eq, ilike } from "drizzle-orm";
import { tags, ticketTags } from "@/db/schema";
import { db } from "@/lib/db";

export type Tag = typeof tags.$inferSelect;

/** Trim + collapse whitespace + lowercase, so "Billing" and "billing " share one row. */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Find-or-create a tag by (normalized) name — the shared pool any agent adds to. */
export async function getOrCreateTagId(rawName: string): Promise<string> {
  const name = normalizeTagName(rawName);
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  try {
    const [created] = await db
      .insert(tags)
      .values({ id: createId(), name })
      .returning({ id: tags.id });
    return created.id;
  } catch {
    // Unique-violation race — another request created it first.
    const [row] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);
    if (!row) {
      throw new Error(`Failed to resolve tag "${name}".`);
    }
    return row.id;
  }
}

export async function getTicketTags(
  ticketId: string
): Promise<Array<{ id: string; name: string }>> {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(ticketTags)
    .innerJoin(tags, eq(ticketTags.tagId, tags.id))
    .where(eq(ticketTags.ticketId, ticketId))
    .orderBy(asc(tags.name));
}

/** Autocomplete search across the shared tag pool. */
export async function searchTags(query: string, limit = 20): Promise<Tag[]> {
  const q = query.trim();
  const rows = await db
    .select()
    .from(tags)
    .where(q ? ilike(tags.name, `%${normalizeTagName(q)}%`) : undefined)
    .orderBy(asc(tags.name))
    .limit(limit);
  return rows;
}
