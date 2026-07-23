import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    name: text("name").notNull(),
    email: text("email").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)]
);
