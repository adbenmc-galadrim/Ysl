CREATE TABLE "deposit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"department_id" uuid NOT NULL,
	"shuttle_id" text NOT NULL,
	"shuttle_name" text,
	"parcel_ids" uuid[] NOT NULL,
	"announced" integer NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"counted" integer,
	"gap" text,
	"gap_parcel_ids" uuid[],
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"confirmed_by_name" text,
	CONSTRAINT "deposit_id_v7" CHECK (coalesce(uuid_extract_version("deposit"."id"), 0) = 7),
	CONSTRAINT "deposit_gap_check" CHECK ("deposit"."gap" in ('missing', 'extra', 'left')),
	CONSTRAINT "deposit_confirmed_check" CHECK (("deposit"."confirmed_at" is null) = ("deposit"."counted" is null))
);
--> statement-breakpoint
ALTER TABLE "sync_op" DROP CONSTRAINT "sync_op_entity_check";--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "former_shuttle_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit" ADD CONSTRAINT "deposit_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."department"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deposit_cursor_idx" ON "deposit" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "deposit_department_idx" ON "deposit" USING btree ("organization_id","department_id");--> statement-breakpoint
CREATE INDEX "deposit_shuttle_idx" ON "deposit" USING btree ("organization_id","shuttle_id");--> statement-breakpoint
ALTER TABLE "sync_op" ADD CONSTRAINT "sync_op_entity_check" CHECK ("sync_op"."entity" in ('directory_person', 'contact', 'sender', 'sender_account', 'batch', 'parcel', 'email_template', 'notification', 'pickup_code', 'handover', 'event', 'setting', 'sender_alias', 'recipient_alias', 'department', 'deposit'));--> statement-breakpoint
CREATE TRIGGER "deposit_stamp_server_xid_insert" BEFORE INSERT ON "deposit" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE TRIGGER "deposit_stamp_server_xid_update" BEFORE UPDATE ON "deposit" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."parcel_status_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  step_back boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    step_back := (OLD.status = 'recu' AND NEW.status = 'a_completer')
      OR (OLD.status = 'en_route' AND NEW.status = 'recu')
      OR (OLD.status = 'depose' AND NEW.status = 'en_route')
      OR (OLD.status = 'a_regulariser' AND NEW.status IN ('depose', 'notifie'))
      OR (OLD.status = 'notifie' AND NEW.status IN ('recu', 'en_route', 'depose'))
      OR (OLD.status = 'remis' AND NEW.status IN ('notifie', 'depose', 'recu'))
      OR (OLD.status = 'retourne' AND NEW.status IN ('notifie', 'depose', 'a_regulariser', 'recu'));
    IF NOT (
      step_back
      OR (OLD.status = 'a_completer' AND NEW.status = 'recu')
      OR (OLD.status = 'recu' AND NEW.status IN ('en_route', 'notifie', 'remis', 'retourne'))
      OR (OLD.status = 'en_route' AND NEW.status IN ('depose', 'a_regulariser', 'notifie'))
      OR (OLD.status = 'depose' AND NEW.status IN ('a_regulariser', 'notifie', 'remis', 'retourne'))
      OR (OLD.status = 'a_regulariser' AND NEW.status IN ('en_route', 'retourne'))
      OR (OLD.status = 'notifie' AND NEW.status IN ('a_regulariser', 'remis', 'retourne'))
    ) THEN
      RAISE EXCEPTION 'parcel % cannot go from % to %', OLD.id, OLD.status, NEW.status
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
    END IF;
    -- `depositedStatus`: « Notifié » only for an e-mail traced during the tour, « Déposé » only without one.
    IF OLD.status = 'en_route' AND (
      (NEW.status = 'notifie' AND OLD.last_notified_at IS NULL)
      OR (NEW.status = 'depose' AND OLD.last_notified_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'parcel % is deposited through its traced e-mail only', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
    END IF;
    IF NEW.status = 'en_route' AND NEW.department_id IS NULL THEN
      RAISE EXCEPTION 'parcel % has no department to go to', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
    END IF;
    IF OLD.status = 'remis' AND (
      EXISTS (
        SELECT 1 FROM "public"."handover"
         WHERE "public"."handover".organization_id = OLD.organization_id
           AND "public"."handover".parcel_ids @> ARRAY[OLD.id]
           AND "public"."handover".at = OLD.delivered_at
           AND "public"."handover".cancelled_at IS NULL
      )
      OR NOT EXISTS (
        SELECT 1 FROM "public"."handover"
         WHERE "public"."handover".organization_id = OLD.organization_id
           AND "public"."handover".parcel_ids @> ARRAY[OLD.id]
           AND "public"."handover".at = OLD.delivered_at
           AND "public"."handover".cancelled_at IS NOT NULL
      )
    ) THEN
      RAISE EXCEPTION 'parcel % is handed over: cancel the handover first', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_delivery_protected';
    END IF;
    -- A deposited parcel does not go back to before its deposit, not even by an old PWA's undo.
    IF NEW.status IN ('a_completer', 'recu') AND OLD.deposited_at IS NOT NULL THEN
      RAISE EXCEPTION 'parcel % is deposited: cancel the deposit first', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
    END IF;
    IF NEW.status = 'depose' OR (OLD.status = 'en_route' AND NEW.status = 'notifie') THEN
      NEW.deposited_at := coalesce(NEW.deposited_at, now());
    END IF;
    -- Only an app that knows the tour writes from it, always with the counter: the
    -- leniency for an app without one would let a stale copy of an old PWA through.
    IF NEW.status_seq = OLD.status_seq AND NOT step_back
       AND OLD.status NOT IN ('en_route', 'depose', 'a_regulariser') THEN
      NEW.status_seq := OLD.status_seq + 1;
    ELSIF NEW.status_seq IS DISTINCT FROM OLD.status_seq + 1 THEN
      RAISE EXCEPTION 'parcel % changed status since this copy (status_seq % sent, % expected)',
        OLD.id, NEW.status_seq, OLD.status_seq + 1
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_stale';
    END IF;
  ELSE
    NEW.status_seq := OLD.status_seq;
    IF OLD.status = 'remis'
       AND (NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
            OR NEW.delivered_by IS DISTINCT FROM OLD.delivered_by) THEN
      RAISE EXCEPTION 'the delivery of parcel % cannot change', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_delivery_protected';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- A handover or a return cancelled: the parcel opens again where it can be read.
-- Not deposited, it follows its person. An archived department holds nothing: it
-- goes back to the person's, or to none for the admin to place. Named to run
-- before `parcel_department_open`, which would refuse it.
CREATE FUNCTION "public"."parcel_department_on_reopen"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  of_person uuid;
  archived boolean;
  deposited boolean;
BEGIN
  IF OLD.status NOT IN ('remis', 'retourne') OR NEW.status IN ('remis', 'retourne') THEN
    RETURN NEW;
  END IF;
  SELECT p.department_id INTO of_person
    FROM "public"."directory_person" AS p
    JOIN "public"."department" AS d
      ON d.organization_id = p.organization_id AND d.id = p.department_id AND d.deleted_at IS NULL
   WHERE p.organization_id = NEW.organization_id AND p.id = NEW.person_id;
  archived := EXISTS (
    SELECT 1 FROM "public"."department" AS d
     WHERE d.organization_id = NEW.organization_id AND d.id = NEW.department_id AND d.deleted_at IS NOT NULL
  );
  deposited := NEW.status = 'depose' OR NEW.deposited_at IS NOT NULL;
  IF archived AND deposited THEN
    NEW.department_id := NULL;
  ELSIF archived OR (of_person IS NOT NULL AND NOT deposited) THEN
    NEW.department_id := of_person;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_department_after_reopen" BEFORE UPDATE ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_department_on_reopen"();--> statement-breakpoint
-- Reopened while it physically sits at a department that is no longer its person's,
-- or at none: the same mark as a person who moves (D25), with its line in the history.
CREATE FUNCTION "public"."parcel_reopened_elsewhere"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "public"."directory_person" AS p
     WHERE p.organization_id = NEW.organization_id AND p.id = NEW.person_id
       AND p.department_id IS NOT NULL AND p.department_id <> NEW.department_id
  ) THEN
    RETURN NULL;
  END IF;
  UPDATE "public"."parcel"
     SET status = 'a_regulariser', status_seq = status_seq + 1, updated_at = now()
   WHERE id = NEW.id;
  INSERT INTO "public"."event" (id, organization_id, entity, entity_id, type, at, detail)
  VALUES (overlay(overlay(gen_random_uuid()::text placing '7' from 15 for 1) placing '8' from 20 for 1)::uuid,
          NEW.organization_id, 'parcel', NEW.id, 'parcel.status', now(),
          jsonb_build_object('from', NEW.status, 'to', 'a_regulariser'));
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_reopened_elsewhere" AFTER UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.status IN ('remis', 'retourne') AND NEW.status IN ('notifie', 'depose') AND NEW.deposited_at IS NOT NULL) EXECUTE FUNCTION "public"."parcel_reopened_elsewhere"();
