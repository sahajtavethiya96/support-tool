import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tickets } from "@/db/schema/tickets";

// Freeform, shared tag pool — any agent can create a new tag by typing it on
// a ticket; it's then reusable/autocompleted by everyone. Unlike
// ticket_statuses/categories/priorities, there is no admin management UI.
export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ticketTags = pgTable(
  "ticket_tags",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ticket_tags_ticket_id_tag_id_idx").on(t.ticketId, t.tagId),
    index("ticket_tags_tag_id_idx").on(t.tagId),
  ]
);
