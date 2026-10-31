ALTER TABLE "sync_op" DROP CONSTRAINT "sync_op_entity_check";--> statement-breakpoint
DROP INDEX "pickup_code_active_person_idx";--> statement-breakpoint
DROP INDEX "pickup_code_active_contact_idx";--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "scope_xid" bigint;--> statement-breakpoint
ALTER TABLE "directory_person" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "pickup_code" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "directory_person" ADD CONSTRAINT "directory_person_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "directory_person_department_idx" ON "directory_person" USING btree ("organization_id","department_id") WHERE "directory_person"."department_id" is not null;--> statement-breakpoint
CREATE INDEX "pickup_code_department_idx" ON "pickup_code" USING btree ("organization_id","department_id") WHERE "pickup_code"."department_id" is not null;--> statement-breakpoint
CREATE INDEX "parcel_department_idx" ON "parcel" USING btree ("organization_id","department_id") WHERE "parcel"."department_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_person_idx" ON "pickup_code" USING btree ("person_id",coalesce("department_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_contact_idx" ON "pickup_code" USING btree ("contact_id",coalesce("department_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "sync_op" ADD CONSTRAINT "sync_op_entity_check" CHECK ("sync_op"."entity" in ('directory_person', 'contact', 'sender', 'sender_account', 'batch', 'parcel', 'email_template', 'notification', 'pickup_code', 'handover', 'event', 'setting', 'sender_alias', 'recipient_alias', 'department'));--> statement-breakpoint
-- A parcel follows the person it is for, whoever writes it: a device, the v1
-- import, an old PWA that knows nothing of departments.
CREATE FUNCTION "public"."parcel_department_of_person"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.person_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.person_id IS DISTINCT FROM OLD.person_id) THEN
    NEW.department_id := (
      SELECT "public"."directory_person".department_id
        FROM "public"."directory_person"
       WHERE "public"."directory_person".organization_id = NEW.organization_id
         AND "public"."directory_person".id = NEW.person_id
    );
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_department_of_person" BEFORE INSERT OR UPDATE OF "person_id" ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_department_of_person"();--> statement-breakpoint
-- A row leaving a department gets no mark its devices could pull: the
-- department remembers the transaction, and `sync.pull` starts them over. Not
-- `UPDATE OF department_id`: the trigger above moves a parcel without that
-- column in the statement.
CREATE FUNCTION "public"."department_row_left"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE "public"."department"
     SET scope_xid = pg_current_xact_id()::text::bigint
   WHERE id = OLD.department_id;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_left_department" AFTER UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.department_id IS NOT NULL AND OLD.department_id IS DISTINCT FROM NEW.department_id) EXECUTE FUNCTION "public"."department_row_left"();--> statement-breakpoint
CREATE TRIGGER "directory_person_left_department" AFTER UPDATE ON "directory_person" FOR EACH ROW WHEN (OLD.department_id IS NOT NULL AND OLD.department_id IS DISTINCT FROM NEW.department_id) EXECUTE FUNCTION "public"."department_row_left"();
