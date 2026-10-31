-- A person who changes department takes along what is still to come (ME21),
-- whoever moves them: the directory router, the CSV import, the conversion.
-- A code goes too: a code of the old department would be refused at the new
-- one. An open code already there wins (one per person and department).
-- Hook of YSL-131: `en_route` joins the list below; `depose` stays where it was
-- and becomes `a_regulariser` here. `PARCEL_ON_MOVE` of @repo/contract says the same.
CREATE FUNCTION "public"."directory_person_moved"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE "public"."parcel"
     SET department_id = NEW.department_id, updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND person_id = NEW.id
     AND deleted_at IS NULL
     AND status IN ('a_completer', 'recu', 'notifie');

  UPDATE "public"."pickup_code" AS moved
     SET deleted_at = now(), updated_at = now()
   WHERE moved.organization_id = NEW.organization_id
     AND moved.person_id = NEW.id
     AND moved.used_at IS NULL
     AND moved.deleted_at IS NULL
     AND moved.department_id IS NOT DISTINCT FROM OLD.department_id
     AND EXISTS (
       SELECT 1 FROM "public"."pickup_code" AS there
        WHERE there.organization_id = NEW.organization_id
          AND there.person_id = NEW.id
          AND there.used_at IS NULL
          AND there.deleted_at IS NULL
          AND there.department_id IS NOT DISTINCT FROM NEW.department_id
     );

  UPDATE "public"."pickup_code"
     SET department_id = NEW.department_id, updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND person_id = NEW.id
     AND used_at IS NULL
     AND deleted_at IS NULL
     AND department_id IS NOT DISTINCT FROM OLD.department_id;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "directory_person_moved" AFTER UPDATE ON "directory_person" FOR EACH ROW WHEN (OLD.department_id IS DISTINCT FROM NEW.department_id) EXECUTE FUNCTION "public"."directory_person_moved"();
