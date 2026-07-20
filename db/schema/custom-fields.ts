import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tickets } from "@/db/schema/tickets";

// Admin-managed field definitions — analogous to ticket_statuses/categories.
// `key` is the stable machine identifier used in API payloads (auto-slugified
// from `label`, immutable after creation); `options` is only populated when
// type === "select".
export const ticketCustomFields = pgTable("ticket_custom_fields", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  options: jsonb("options").$type<string[]>(),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Per-ticket values — analogous to ticket_tags. Stored as text regardless of
// field type ("true"/"false" for checkbox, numeric string, ISO date string,
// or the selected option) so one column covers every type without a schema
// migration per field. Deleting a field definition cascades here.
export const ticketCustomFieldValues = pgTable(
  "ticket_custom_field_values",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fieldId: text("field_id")
      .notNull()
      .references(() => ticketCustomFields.id, { onDelete: "cascade" }),
    value: text("value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ticket_custom_field_values_ticket_id_field_id_idx").on(
      t.ticketId,
      t.fieldId
    ),
    index("ticket_custom_field_values_field_id_idx").on(t.fieldId),
  ]
);
