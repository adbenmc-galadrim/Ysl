-- ME25: the department seen at the review travels with a new parcel. A parcel
-- that comes without one follows its card. A blank card empties the department,
-- except on one being given its first (the agent's choice) or on tour, which
-- cannot go without.
CREATE OR REPLACE FUNCTION "public"."parcel_department_of_person"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  of_person uuid;
BEGIN
  IF NEW.person_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.person_id IS DISTINCT FROM OLD.person_id) THEN
    of_person := (
      SELECT "public"."directory_person".department_id
        FROM "public"."directory_person"
       WHERE "public"."directory_person".organization_id = NEW.organization_id
         AND "public"."directory_person".id = NEW.person_id
    );
    NEW.department_id := CASE TG_OP
      WHEN 'INSERT' THEN coalesce(NEW.department_id, of_person)
      ELSE coalesce(
        of_person,
        CASE WHEN OLD.department_id IS NULL OR NEW.status = 'en_route'
          THEN NEW.department_id
        END
      )
    END;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- Going on tour takes a department, for a parcel born there too. After the row:
-- `sync.push` upserts, and a BEFORE INSERT would judge the proposal of an update.
CREATE FUNCTION "public"."parcel_born_on_tour"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    RAISE EXCEPTION 'parcel % has no department to go to', NEW.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_on_tour_has_department" AFTER INSERT ON "parcel" FOR EACH ROW WHEN (NEW.status = 'en_route') EXECUTE FUNCTION "public"."parcel_born_on_tour"();--> statement-breakpoint
-- ME25: with a tour, a parcel without a department waits « À compléter »: the
-- mail department stays the fallback of a shuttle acting as department only.
CREATE OR REPLACE FUNCTION "public"."parcel_department_of_contact"() RETURNS trigger
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
          AND lower(d.name) = 'service courrier'
          AND NOT EXISTS (
            SELECT 1 FROM "public"."setting" AS s
             WHERE s.organization_id = NEW.organization_id
               AND s.key = 'operatingProfile'
               AND s.deleted_at IS NULL
               AND s.value->>'shuttleActsAsDepartment' = 'false'
          ))
    );
  END IF;
  RETURN NEW;
END;
$$;
