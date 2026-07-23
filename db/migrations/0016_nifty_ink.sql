CREATE TABLE "sla_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"priority" text,
	"category" text,
	"first_response_minutes" integer NOT NULL,
	"next_response_minutes" integer NOT NULL,
	"resolution_minutes" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "waiting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "first_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "sla_active_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill first_responded_at for tickets that already have a public agent/admin
-- reply, so existing installs don't show every open ticket as "never responded"
-- the moment this migration ships. waiting_since and sla_active_seconds are
-- deliberately left at their defaults for existing rows — the SLA calculation
-- code (lib/sla.ts) falls back to created_at when waiting_since is null, and
-- pre-migration active time isn't reconstructed (tracked accurately from here
-- forward only).
UPDATE "tickets" t
SET "first_responded_at" = first_reply.created_at
FROM (
	SELECT DISTINCT ON (ticket_id) ticket_id, created_at
	FROM "ticket_comments"
	WHERE author_role IN ('agent', 'admin') AND is_internal = false
	ORDER BY ticket_id, created_at ASC
) AS first_reply
WHERE t.id = first_reply.ticket_id AND t."first_responded_at" IS NULL;