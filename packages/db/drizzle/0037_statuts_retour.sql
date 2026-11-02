ALTER TABLE "parcel" DROP CONSTRAINT "parcel_status_check";--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "return_reason" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_return_reason_check" CHECK ("parcel"."return_reason" in ('unclaimed', 'refused', 'left', 'address', 'lost'));--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_status_check" CHECK ("parcel"."status" in ('a_completer', 'recu', 'en_route', 'depose', 'a_regulariser', 'notifie', 'remis', 'retour_prepare', 'retour_en_route', 'retourne'));--> statement-breakpoint
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
      OR (OLD.status = 'retour_prepare' AND NEW.status IN ('notifie', 'depose'))
      OR (OLD.status = 'retour_en_route' AND NEW.status = 'retour_prepare')
      OR (OLD.status = 'retourne' AND NEW.status IN ('retour_en_route', 'retour_prepare', 'notifie', 'depose', 'a_regulariser', 'recu'));
    IF NOT (
      step_back
      OR (OLD.status = 'a_completer' AND NEW.status = 'recu')
      OR (OLD.status = 'recu' AND NEW.status IN ('en_route', 'notifie', 'remis', 'retourne'))
      OR (OLD.status = 'en_route' AND NEW.status IN ('depose', 'a_regulariser', 'notifie'))
      OR (OLD.status = 'depose' AND NEW.status IN ('a_regulariser', 'notifie', 'remis', 'retour_prepare', 'retourne'))
      OR (OLD.status = 'a_regulariser' AND NEW.status IN ('en_route', 'retourne'))
      OR (OLD.status = 'notifie' AND NEW.status IN ('a_regulariser', 'remis', 'retour_prepare', 'retourne'))
      OR (OLD.status = 'retour_prepare' AND NEW.status IN ('retour_en_route', 'retourne'))
      OR (OLD.status = 'retour_en_route' AND NEW.status = 'retourne')
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
       AND OLD.status NOT IN ('en_route', 'depose', 'a_regulariser', 'retour_prepare', 'retour_en_route') THEN
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
CREATE OR REPLACE FUNCTION "public"."parcel_department_on_reopen"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  of_person uuid;
  archived boolean;
  deposited boolean;
BEGIN
  IF OLD.status NOT IN ('remis', 'retour_prepare', 'retour_en_route', 'retourne')
     OR NEW.status IN ('remis', 'retour_prepare', 'retour_en_route', 'retourne') THEN
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
DROP TRIGGER "parcel_reopened_elsewhere" ON "parcel";--> statement-breakpoint
CREATE TRIGGER "parcel_reopened_elsewhere" AFTER UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.status IN ('remis', 'retour_prepare', 'retour_en_route', 'retourne') AND NEW.status IN ('notifie', 'depose') AND NEW.deposited_at IS NOT NULL) EXECUTE FUNCTION "public"."parcel_reopened_elsewhere"();--> statement-breakpoint
-- A parcel that starts back to its sender is no longer collected: its code closes once
-- nothing else waits for that person at that department, whichever path moved it.
CREATE FUNCTION "public"."parcel_return_closes_code"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.person_id IS NULL AND NEW.contact_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "public"."parcel" AS other
     WHERE other.organization_id = NEW.organization_id
       AND other.id <> NEW.id
       AND other.deleted_at IS NULL
       AND other.status IN ('recu', 'depose', 'notifie')
       AND other.person_id IS NOT DISTINCT FROM NEW.person_id
       AND other.contact_id IS NOT DISTINCT FROM NEW.contact_id
       AND other.department_id IS NOT DISTINCT FROM NEW.department_id
  ) THEN
    RETURN NULL;
  END IF;
  UPDATE "public"."pickup_code"
     SET deleted_at = now(), updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND deleted_at IS NULL
     AND used_at IS NULL
     AND person_id IS NOT DISTINCT FROM NEW.person_id
     AND contact_id IS NOT DISTINCT FROM NEW.contact_id
     AND department_id IS NOT DISTINCT FROM NEW.department_id;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_return_closes_code" AFTER UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.status IN ('recu', 'depose', 'notifie', 'a_regulariser') AND NEW.status IN ('retour_prepare', 'retourne')) EXECUTE FUNCTION "public"."parcel_return_closes_code"();--> statement-breakpoint
UPDATE "parcel" SET "return_reason" = 'lost' WHERE "status" = 'retourne' AND "notes" LIKE '%Déclaré perdu par l’admin de l’entreprise.%';
