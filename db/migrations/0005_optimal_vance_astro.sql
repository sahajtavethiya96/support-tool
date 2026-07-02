CREATE TABLE "ticket_priorities" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_priorities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" USING btree ("priority");