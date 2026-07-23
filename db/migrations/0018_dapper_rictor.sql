ALTER TABLE "tickets" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "customer_name";--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "customer_email";