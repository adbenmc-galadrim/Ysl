CREATE TABLE "scan_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"user_id" text NOT NULL,
	"report" jsonb NOT NULL,
	"comment" text,
	"image_type" text NOT NULL,
	"image" "bytea" NOT NULL,
	"image_bytes" integer NOT NULL,
	"image_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_report_image_type_check" CHECK ("scan_report"."image_type" in ('image/jpeg', 'image/png'))
);
--> statement-breakpoint
CREATE INDEX "scan_report_created_idx" ON "scan_report" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "scan_report" ALTER COLUMN "image" SET STORAGE EXTERNAL;