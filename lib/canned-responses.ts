import { asc } from "drizzle-orm";
import { cannedResponses } from "@/db/schema";
import { db } from "@/lib/db";

export type CannedResponse = typeof cannedResponses.$inferSelect;

export async function getCannedResponses(): Promise<CannedResponse[]> {
  return db.select().from(cannedResponses).orderBy(asc(cannedResponses.title));
}
