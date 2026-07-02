import { asc, eq } from "drizzle-orm";
import {
  ticketCategories,
  ticketPriorities,
  ticketStatuses,
} from "@/db/schema";
import { db } from "@/lib/db";

export type TicketStatus = typeof ticketStatuses.$inferSelect;
export type TicketCategory = typeof ticketCategories.$inferSelect;
export type TicketPriority = typeof ticketPriorities.$inferSelect;

export async function getTicketStatuses(): Promise<TicketStatus[]> {
  return db
    .select()
    .from(ticketStatuses)
    .orderBy(asc(ticketStatuses.sortOrder));
}

export async function getTicketCategories(): Promise<TicketCategory[]> {
  return db
    .select()
    .from(ticketCategories)
    .orderBy(asc(ticketCategories.sortOrder));
}

export async function getTicketPriorities(): Promise<TicketPriority[]> {
  return db
    .select()
    .from(ticketPriorities)
    .orderBy(asc(ticketPriorities.sortOrder));
}

export async function getDefaultPriority(): Promise<
  TicketPriority | undefined
> {
  const [row] = await db
    .select()
    .from(ticketPriorities)
    .where(eq(ticketPriorities.isDefault, true))
    .limit(1);
  return row;
}

export async function getDefaultStatus(): Promise<TicketStatus | undefined> {
  const [row] = await db
    .select()
    .from(ticketStatuses)
    .where(eq(ticketStatuses.isDefault, true))
    .limit(1);
  return row;
}

/** The status a ticket moves to when closed — first one flagged as a closed state. */
export async function getClosedStatus(): Promise<TicketStatus | undefined> {
  const [row] = await db
    .select()
    .from(ticketStatuses)
    .where(eq(ticketStatuses.isClosedState, true))
    .orderBy(asc(ticketStatuses.sortOrder))
    .limit(1);
  return row;
}

/** Whether a given status slug represents a closed state. */
export async function isClosedStatusSlug(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ isClosedState: ticketStatuses.isClosedState })
    .from(ticketStatuses)
    .where(eq(ticketStatuses.slug, slug))
    .limit(1);
  return row?.isClosedState ?? false;
}
