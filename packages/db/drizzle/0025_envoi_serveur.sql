CREATE TABLE "email_suppression" (
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_suppression_organization_id_email_pk" PRIMARY KEY("organization_id","email"),
	CONSTRAINT "email_suppression_reason_check" CHECK ("email_suppression"."reason" in ('unsubscribed', 'complained'))
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "pickup_code_id" uuid;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "replaced_code_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "channel" text DEFAULT 'phone' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_suppression" ADD CONSTRAINT "email_suppression_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_server_request_idx" ON "notification" USING btree ("prepared_at") WHERE "notification"."channel" = 'server' and "notification"."status" = 'prepared';--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_channel_check" CHECK ("notification"."channel" in ('phone', 'server'));--> statement-breakpoint
-- An expired code already at the new department no longer beats the valid one that moves in.
CREATE OR REPLACE FUNCTION "public"."directory_person_moved"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE "public"."parcel"
     SET department_id = NEW.department_id, updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND person_id = NEW.id
     AND deleted_at IS NULL
     AND status IN ('a_completer', 'recu', 'notifie');

  UPDATE "public"."pickup_code" AS there
     SET deleted_at = now(), updated_at = now()
   WHERE there.organization_id = NEW.organization_id
     AND there.person_id = NEW.id
     AND there.used_at IS NULL
     AND there.deleted_at IS NULL
     AND there.expires_at <= now()
     AND there.department_id = NEW.department_id
     AND EXISTS (
       SELECT 1 FROM "public"."pickup_code" AS moved
        WHERE moved.organization_id = NEW.organization_id
          AND moved.person_id = NEW.id
          AND moved.used_at IS NULL
          AND moved.deleted_at IS NULL
          AND moved.expires_at > now()
          AND moved.department_id = OLD.department_id
     );

  UPDATE "public"."pickup_code" AS moved
     SET deleted_at = now(), updated_at = now()
   WHERE moved.organization_id = NEW.organization_id
     AND moved.person_id = NEW.id
     AND moved.used_at IS NULL
     AND moved.deleted_at IS NULL
     AND moved.department_id = OLD.department_id
     AND EXISTS (
       SELECT 1 FROM "public"."pickup_code" AS there
        WHERE there.organization_id = NEW.organization_id
          AND there.person_id = NEW.id
          AND there.used_at IS NULL
          AND there.deleted_at IS NULL
          AND there.department_id = NEW.department_id
     );

  UPDATE "public"."pickup_code"
     SET department_id = NEW.department_id, updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND person_id = NEW.id
     AND used_at IS NULL
     AND deleted_at IS NULL
     AND department_id = OLD.department_id;
  RETURN NULL;
END;
$$;--> statement-breakpoint
-- A parcel for a contact has no trigger to give it a department, and a code opens only
-- one (§3.7.9): the conversion's rule. A parcel for nobody yet stays with the shuttle.
CREATE FUNCTION "public"."parcel_department_of_contact"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.person_id IS NULL AND NEW.contact_id IS NOT NULL AND NEW.department_id IS NULL THEN
    NEW.department_id := coalesce(
      (SELECT d.id FROM "public"."department" AS d
        WHERE d.organization_id = NEW.organization_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = lower(trim(NEW.department))),
      (SELECT d.id FROM "public"."department" AS d
         JOIN "public"."contact" AS k ON k.organization_id = d.organization_id
        WHERE k.id = NEW.contact_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = lower(trim(k.department))),
      (SELECT d.id FROM "public"."department" AS d
        WHERE d.organization_id = NEW.organization_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = 'service courrier')
    );
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- Named to fire before `parcel_department_open`, which checks what it sets.
CREATE TRIGGER "parcel_department_of_contact" BEFORE INSERT OR UPDATE ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_department_of_contact"();--> statement-breakpoint
-- The contacts' parcels written since the conversion: the trigger above places them.
UPDATE "parcel" SET updated_at = updated_at
 WHERE person_id IS NULL AND contact_id IS NOT NULL AND department_id IS NULL
   AND status IN ('a_completer', 'recu', 'notifie');
