CREATE TABLE "department" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"name" text NOT NULL,
	"reception_point" text,
	"pickup" jsonb,
	CONSTRAINT "department_id_v7" CHECK (coalesce(uuid_extract_version("department"."id"), 0) = 7)
);
--> statement-breakpoint
CREATE TABLE "department_member" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"department_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_member" ADD CONSTRAINT "department_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_member" ADD CONSTRAINT "department_member_organization_member_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."organization_member"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_cursor_idx" ON "department" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_organization_id_idx" ON "department" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "department_member" ADD CONSTRAINT "department_member_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_name_idx" ON "department" USING btree ("organization_id",lower("name")) WHERE "department"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "department_member_department_idx" ON "department_member" USING btree ("department_id");--> statement-breakpoint
CREATE TRIGGER "department_stamp_server_xid_insert" BEFORE INSERT ON "department" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE TRIGGER "department_stamp_server_xid_update" BEFORE UPDATE ON "department" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
