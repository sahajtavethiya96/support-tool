CREATE TABLE "rate_limit_hits" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_hits_bucket_window_idx" ON "rate_limit_hits" USING btree ("bucket_key","window_start");