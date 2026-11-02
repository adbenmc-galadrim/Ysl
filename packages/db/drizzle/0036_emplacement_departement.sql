-- The location is a shelf of the department's reception point: a parcel that
-- changes department leaves it behind, whichever way it moved. Named to run after
-- `parcel_department_of_*`, which may set the department in this same write.
CREATE FUNCTION "public"."parcel_location_of_department"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.location := NULL;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "parcel_location_of_department" BEFORE UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.department_id IS NOT NULL AND OLD.department_id IS DISTINCT FROM NEW.department_id AND OLD.location IS NOT DISTINCT FROM NEW.location AND NEW.location IS NOT NULL) EXECUTE FUNCTION "public"."parcel_location_of_department"();
