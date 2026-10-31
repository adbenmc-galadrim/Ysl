ALTER TABLE "parcel" DROP CONSTRAINT "parcel_status_check";--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "deposited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_status_check" CHECK ("parcel"."status" in ('a_completer', 'recu', 'en_route', 'depose', 'a_regulariser', 'notifie', 'remis', 'retourne'));--> statement-breakpoint
-- A person who moves: what is on tour follows; a parcel already deposited stays
-- with its department and is marked, with its line in the history (D25).
CREATE OR REPLACE FUNCTION "public"."directory_person_moved"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE "public"."parcel"
     SET department_id = NEW.department_id, updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND person_id = NEW.id
     AND deleted_at IS NULL
     AND (status IN ('a_completer', 'recu', 'en_route')
          OR (status = 'notifie' AND deposited_at IS NULL));

  WITH deposited AS (
    SELECT id, status FROM "public"."parcel"
     WHERE organization_id = NEW.organization_id
       AND person_id = NEW.id
       AND deleted_at IS NULL
       AND (status = 'depose' OR (status = 'notifie' AND deposited_at IS NOT NULL))
       FOR UPDATE
  ), settled AS (
    UPDATE "public"."parcel" AS p
       SET status = 'a_regulariser', status_seq = p.status_seq + 1, updated_at = now()
      FROM deposited
     WHERE p.id = deposited.id
    RETURNING p.id, deposited.status AS was
  )
  INSERT INTO "public"."event" (id, organization_id, entity, entity_id, type, at, detail)
  SELECT overlay(overlay(gen_random_uuid()::text placing '7' from 15 for 1) placing '8' from 20 for 1)::uuid,
         NEW.organization_id, 'parcel', settled.id, 'parcel.status', now(),
         jsonb_build_object('from', settled.was, 'to', 'a_regulariser')
    FROM settled;

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
-- §8.3: the tour. `en_route` to `notifie` is the deposit of a parcel whose e-mail
-- left during the tour (§3.7.9). Going on tour takes a department (ME25).
CREATE OR REPLACE FUNCTION "public"."parcel_status_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  step_back boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    step_back := (OLD.status = 'recu' AND NEW.status = 'a_completer')
      OR (OLD.status = 'en_route' AND NEW.status IN ('recu', 'a_regulariser'))
      OR (OLD.status = 'depose' AND NEW.status = 'en_route')
      OR (OLD.status = 'a_regulariser' AND NEW.status IN ('en_route', 'depose', 'notifie'))
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
    IF NEW.status_seq = OLD.status_seq AND NOT step_back THEN
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
CREATE OR REPLACE FUNCTION "public"."parcel_department_open"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR (NEW.status IN ('a_completer', 'recu', 'en_route', 'depose', 'a_regulariser', 'notifie')
         AND OLD.status NOT IN ('a_completer', 'recu', 'en_route', 'depose', 'a_regulariser', 'notifie')) THEN
    PERFORM "public"."refuse_archived_department"(NEW.department_id);
  END IF;
  RETURN NEW;
END;
$$;
