CREATE TABLE "mail_sender" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"declared" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mail_sender_status_check" CHECK ("mail_sender"."status" in ('pending', 'verified'))
);
--> statement-breakpoint
ALTER TABLE "mail_sender" ADD CONSTRAINT "mail_sender_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mail_sender_domain_idx" ON "mail_sender" USING btree ("domain");