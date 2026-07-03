import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

// A caller identity for the public API (app/api/v1/*) — a third auth mode
// alongside agent/admin sessions and customer ticket tokens. The raw key is
// shown to the admin once at creation and never stored; only a sha256 hash
// (for lookup) and a short prefix (for display in the admin UI) persist.
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdById: text("created_by_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdByName: text("created_by_name").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  // Soft revoke — the row stays for audit history (tickets.apiKeyId keeps
  // resolving) instead of being deleted.
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
