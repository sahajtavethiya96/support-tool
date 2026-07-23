import { asc } from "drizzle-orm";
import { slaPolicies } from "@/db/schema/sla-policies";
import { db } from "@/lib/db";

export type SlaPolicy = typeof slaPolicies.$inferSelect;

export async function getSlaPolicies(): Promise<SlaPolicy[]> {
  return db.select().from(slaPolicies).orderBy(asc(slaPolicies.sortOrder));
}

/**
 * Most-specific-wins match against a ticket's (priority, category):
 * exact scope > priority-only > category-only > the global default.
 * Resolved live against the current policy list — not snapshotted per
 * ticket — so editing a policy immediately re-targets its matching open
 * tickets (see docs/plans/12-sla.md for the trade-off).
 */
export function resolveSlaPolicy(
  policies: SlaPolicy[],
  category: string,
  priority: string
): SlaPolicy | null {
  const exact = policies.find(
    (p) => p.priority === priority && p.category === category
  );
  if (exact) {
    return exact;
  }
  const priorityOnly = policies.find(
    (p) => p.priority === priority && p.category === null
  );
  if (priorityOnly) {
    return priorityOnly;
  }
  const categoryOnly = policies.find(
    (p) => p.priority === null && p.category === category
  );
  if (categoryOnly) {
    return categoryOnly;
  }
  return policies.find((p) => p.isDefault) ?? null;
}
