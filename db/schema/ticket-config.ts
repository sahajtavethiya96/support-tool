import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ticketStatuses = pgTable("ticket_statuses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("blue"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isClosedState: boolean("is_closed_state").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketCategories = pgTable("ticket_categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("slate"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketPriorities = pgTable("ticket_priorities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("slate"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
