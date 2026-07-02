import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    ticketNumber: serial("ticket_number").notNull().unique(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerToken: text("customer_token").notNull().unique(),
    assignedAgentId: text("assigned_agent_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // "Awaiting reply": true when the latest public message is from the customer
    // (a new ticket, or a customer reply). Cleared when an agent posts a public
    // reply. `pendingReplies` counts customer messages since the last agent reply
    // — shown as a WhatsApp-style unread badge on the ticket list.
    awaitingReply: boolean("awaiting_reply").notNull().default(false),
    pendingReplies: integer("pending_replies").notNull().default(0),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tickets_ticket_number_idx").on(t.ticketNumber),
    index("tickets_customer_email_idx").on(t.customerEmail),
    index("tickets_status_idx").on(t.status),
    index("tickets_assigned_agent_id_idx").on(t.assignedAgentId),
    index("tickets_created_at_idx").on(t.createdAt),
    index("tickets_awaiting_reply_idx").on(t.awaitingReply),
    index("tickets_priority_idx").on(t.priority),
  ]
);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").notNull(),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ticket_comments_ticket_id_idx").on(t.ticketId),
    index("ticket_comments_author_id_idx").on(t.authorId),
    index("ticket_comments_is_internal_idx").on(t.isInternal),
  ]
);

export const ticketAttachments = pgTable(
  "ticket_attachments",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    commentId: text("comment_id").references(() => ticketComments.id, {
      onDelete: "set null",
    }),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: text("mime_type").notNull(),
    uploadedById: text("uploaded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    uploadedByName: text("uploaded_by_name").notNull(),
    uploadedByRole: text("uploaded_by_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ticket_attachments_ticket_id_idx").on(t.ticketId),
    index("ticket_attachments_comment_id_idx").on(t.commentId),
  ]
);

export const ticketActivity = pgTable(
  "ticket_activity",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ticket_activity_ticket_id_idx").on(t.ticketId),
    index("ticket_activity_created_at_idx").on(t.createdAt),
  ]
);
