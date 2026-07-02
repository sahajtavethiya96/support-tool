import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

// Team-shared reply templates agents can insert into the reply editor.
// `content` is Tiptap JSON — same shape as `ticketComments.content` — so it
// can be inserted directly into the editor with no format conversion.
export const cannedResponses = pgTable(
  "canned_responses",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("canned_responses_title_idx").on(t.title)]
);
