CREATE TABLE "directory_move_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"requested_by" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "directory_person_email_idx";--> statement-breakpoint
ALTER TABLE "directory_move_request" ADD CONSTRAINT "directory_move_request_person_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "public"."directory_person"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_move_request" ADD CONSTRAINT "directory_move_request_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "directory_move_request_open_idx" ON "directory_move_request" USING btree ("organization_id","person_id") WHERE "directory_move_request"."closed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "directory_person_email_idx" ON "directory_person" USING btree ("organization_id",coalesce("department_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("email")) WHERE "directory_person"."deleted_at" is null;