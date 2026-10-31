CREATE TABLE "company_logo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_logo_content_type_check" CHECK ("company_logo"."content_type" in ('image/png', 'image/jpeg'))
);
--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "reply_email" text;--> statement-breakpoint
ALTER TABLE "company_logo" ADD CONSTRAINT "company_logo_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_logo_organization_idx" ON "company_logo" USING btree ("organization_id");--> statement-breakpoint
-- ME34: what was written in the code for every company until now becomes the
-- setting of the companies already there, so they read labels exactly as before.
-- A company created later has no row: no postal check, no anchor.
INSERT INTO "setting" (id, organization_id, key, value)
SELECT (lpad(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0')
        || '7' || substr(r, 14, 3) || '8' || substr(r, 18, 15))::uuid,
       o.id, 'company',
       '{"reception":{"postalCode":"75007","anchors":["Yves Saint Laurent","Saint Laurent","YSL","Saint","Bellechasse"]}}'::jsonb
  FROM "organization" AS o,
       LATERAL (SELECT replace(gen_random_uuid()::text, '-', '') || o.id::text AS r) AS random
 WHERE NOT EXISTS (
   SELECT 1 FROM "setting" AS s
    WHERE s.organization_id = o.id AND s.key = 'company' AND s.deleted_at IS NULL
 );
