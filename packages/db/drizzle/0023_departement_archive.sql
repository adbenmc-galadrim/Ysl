-- Nobody hands over the parcels of an archived department: neither a parcel nor
-- a person joins one, and a parcel back to waiting does not reopen there,
-- whoever writes it (a device, the v1 import, a cancelled handover or return).
-- `en_route` joins the list with YSL-131, as in `directory_person_moved`.
CREATE FUNCTION "public"."refuse_archived_department"(target uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "public"."department"
     WHERE id = target AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'department % is archived', target
      USING ERRCODE = 'check_violation', CONSTRAINT = 'department_archived';
  END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "public"."parcel_department_open"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR (NEW.status IN ('a_completer', 'recu', 'notifie')
         AND OLD.status NOT IN ('a_completer', 'recu', 'notifie')) THEN
    PERFORM "public"."refuse_archived_department"(NEW.department_id);
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "public"."directory_person_department_open"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    PERFORM "public"."refuse_archived_department"(NEW.department_id);
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- Named to fire after `parcel_department_of_person`, which may set the department.
CREATE TRIGGER "parcel_department_open" BEFORE INSERT OR UPDATE ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_department_open"();--> statement-breakpoint
CREATE TRIGGER "directory_person_department_open" BEFORE INSERT OR UPDATE ON "directory_person" FOR EACH ROW EXECUTE FUNCTION "public"."directory_person_department_open"();
