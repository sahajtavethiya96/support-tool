CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "tickets_customer_email_idx";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "customer_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
-- Backfill: one customer row per distinct (lowercased) email, keeping the
-- most-recently-used customer_name for that email as the canonical name.
INSERT INTO "customers" ("id", "name", "email", "created_at", "updated_at")
SELECT DISTINCT ON (lower(t."customer_email"))
	gen_random_uuid()::text,
	t."customer_name",
	lower(t."customer_email"),
	now(),
	now()
FROM "tickets" t
ORDER BY lower(t."customer_email"), t."created_at" DESC;--> statement-breakpoint
UPDATE "tickets" t
SET "customer_id" = c."id"
FROM "customers" c
WHERE lower(t."customer_email") = c."email";--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_customer_id_idx" ON "tickets" USING btree ("customer_id");