CREATE TABLE "ticket_custom_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"field_id" text NOT NULL,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_custom_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_custom_fields_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "ticket_custom_field_values" ADD CONSTRAINT "ticket_custom_field_values_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_custom_field_values" ADD CONSTRAINT "ticket_custom_field_values_field_id_ticket_custom_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."ticket_custom_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_custom_field_values_ticket_id_field_id_idx" ON "ticket_custom_field_values" USING btree ("ticket_id","field_id");--> statement-breakpoint
CREATE INDEX "ticket_custom_field_values_field_id_idx" ON "ticket_custom_field_values" USING btree ("field_id");