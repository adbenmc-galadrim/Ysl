-- YSL-140: the department is an id since the conversion (0024); the text of a
-- person or a parcel goes. Nothing it still says is dropped unseen: a word that
-- names an open department gives that department to a row that has none, a
-- parcel's other word stays in its notes, a card's other word stops the
-- migration. A row with a department keeps it: the id is right, the word may
-- predate a rename or a move.
UPDATE "directory_person" AS p
   SET department_id = d.id, updated_at = now()
  FROM "department" AS d
 WHERE p.department_id IS NULL
   AND p.deleted_at IS NULL
   AND trim(coalesce(p.department, '')) <> ''
   AND d.organization_id = p.organization_id
   AND d.deleted_at IS NULL
   AND lower(d.name) = lower(trim(p.department))
   AND NOT EXISTS (
     SELECT 1 FROM "directory_person" AS twin
      WHERE twin.organization_id = p.organization_id
        AND twin.department_id = d.id
        AND twin.deleted_at IS NULL
        AND lower(twin.email) = lower(p.email)
   );--> statement-breakpoint
DO $$
DECLARE
  left_over integer;
BEGIN
  SELECT count(*) INTO left_over FROM "directory_person"
   WHERE department_id IS NULL
     AND deleted_at IS NULL
     AND trim(coalesce(department, '')) <> '';
  IF left_over > 0 THEN
    RAISE EXCEPTION 'YSL-140: % fiche(s) de l''annuaire n''ont que le texte de leur département, qu''aucun département ouvert ne porte. Les rattacher (directory.move) avant de déployer.', left_over
      USING HINT = 'SELECT id, department FROM directory_person WHERE department_id IS NULL AND deleted_at IS NULL AND trim(coalesce(department, '''')) <> ''''';
  END IF;
END;
$$;--> statement-breakpoint
-- Their parcels without one follow them: a move only carries those of the old department.
UPDATE "parcel" AS p
   SET department_id = c.department_id, updated_at = now()
  FROM "directory_person" AS c
 WHERE p.department_id IS NULL
   AND p.deleted_at IS NULL
   AND c.organization_id = p.organization_id
   AND c.id = p.person_id
   AND c.department_id IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM "department" AS d
      WHERE d.id = c.department_id AND d.deleted_at IS NULL
   );--> statement-breakpoint
UPDATE "parcel" AS p
   SET department_id = d.id, updated_at = now()
  FROM "department" AS d
 WHERE p.department_id IS NULL
   AND p.deleted_at IS NULL
   AND trim(coalesce(p.department, '')) <> ''
   AND d.organization_id = p.organization_id
   AND d.deleted_at IS NULL
   AND lower(d.name) = lower(trim(p.department));--> statement-breakpoint
UPDATE "parcel"
   SET notes = concat_ws(E'\n', 'Ancien département : ' || trim(department), notes),
       updated_at = now()
 WHERE department_id IS NULL
   AND deleted_at IS NULL
   AND trim(coalesce(department, '')) <> '';--> statement-breakpoint
-- A contact's parcel: the word kept with the contact, then the mail department.
CREATE OR REPLACE FUNCTION "public"."parcel_department_of_contact"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.person_id IS NULL AND NEW.contact_id IS NOT NULL AND NEW.department_id IS NULL THEN
    NEW.department_id := coalesce(
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
$$;--> statement-breakpoint
ALTER TABLE "directory_person" DROP COLUMN "department";--> statement-breakpoint
ALTER TABLE "parcel" DROP COLUMN "department";