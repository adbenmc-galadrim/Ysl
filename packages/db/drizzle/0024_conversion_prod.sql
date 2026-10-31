-- The conversion to the multi-company model (ME09, D21, D22, §3.7.9). It reads
-- what is there and only fills what is empty: nothing happens on an empty
-- database, and a second run changes nothing. The old text columns stay until
-- a later migration, for the way back (docs/conversion-multi-entreprises.md).
CREATE OR REPLACE FUNCTION pg_temp.conversion_uuid7() RETURNS uuid
LANGUAGE sql VOLATILE AS $$
  SELECT (lpad(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0')
          || '7' || substr(r, 14, 3) || '8' || substr(r, 18, 15))::uuid
    FROM (SELECT replace(gen_random_uuid()::text, '-', '') AS r) AS random;
$$;--> statement-breakpoint
-- D22: the mail service is a department like any other, and the default one.
INSERT INTO "department" (id, organization_id, name)
SELECT pg_temp.conversion_uuid7(), o.id, 'Service courrier'
  FROM "organization" AS o
 WHERE NOT EXISTS (
   SELECT 1 FROM "department" AS d
    WHERE d.organization_id = o.id
      AND d.deleted_at IS NULL
      AND lower(d.name) = 'service courrier'
 );--> statement-breakpoint
-- Each word of the old `department` columns, whatever its case or its spaces.
INSERT INTO "department" (id, organization_id, name)
SELECT pg_temp.conversion_uuid7(), named.organization_id, min(named.name)
  FROM (
    SELECT organization_id, trim(department) AS name
      FROM "directory_person" WHERE deleted_at IS NULL
    UNION ALL
    SELECT organization_id, trim(department) AS name
      FROM "parcel" WHERE deleted_at IS NULL
    UNION ALL
    SELECT c.organization_id, trim(c.department) AS name
      FROM "contact" AS c
     WHERE EXISTS (SELECT 1 FROM "parcel" AS w
                    WHERE w.contact_id = c.id AND w.deleted_at IS NULL)
  ) AS named
 WHERE named.name <> ''
   AND NOT EXISTS (
     SELECT 1 FROM "department" AS d
      WHERE d.organization_id = named.organization_id
        AND d.deleted_at IS NULL
        AND lower(d.name) = lower(named.name)
   )
 GROUP BY named.organization_id, lower(named.name);--> statement-breakpoint
-- The one place setting becomes each department's; e-mails still read the setting.
UPDATE "department" AS d
   SET pickup = s.value, updated_at = now()
  FROM "setting" AS s
 WHERE s.organization_id = d.organization_id
   AND s.key = 'pickup'
   AND s.deleted_at IS NULL
   AND d.pickup IS NULL
   AND d.deleted_at IS NULL;--> statement-breakpoint
-- `directory_person_moved` takes along the open parcels and open codes of each person.
-- An e-mail is unique per department (0022): a person whose address their
-- department already holds stays without one, for an admin to settle. Stopping
-- here would stop the deployment.
UPDATE "directory_person" AS p
   SET department_id = chosen.department_id, updated_at = now()
  FROM (
    SELECT w.id, coalesce(
      (SELECT d.id FROM "department" AS d
        WHERE d.organization_id = w.organization_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = lower(trim(w.department))),
      (SELECT d.id FROM "department" AS d
        WHERE d.organization_id = w.organization_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = 'service courrier')
    ) AS department_id
      FROM "directory_person" AS w
     WHERE w.department_id IS NULL
  ) AS chosen
 WHERE p.id = chosen.id
   AND (p.deleted_at IS NOT NULL OR NOT EXISTS (
     SELECT 1 FROM "directory_person" AS there
      WHERE there.organization_id = p.organization_id
        AND there.department_id = chosen.department_id
        AND there.deleted_at IS NULL
        AND lower(there.email) = lower(p.email)
   ));--> statement-breakpoint
-- What the trigger leaves: delivered and returned parcels, deleted ones, those
-- without a person. A parcel's own word first, for where it was then; a contact
-- has no department of its own, its word only speaks for its parcels.
UPDATE "parcel" AS c
   SET department_id = coalesce(
         (SELECT d.id FROM "department" AS d
           WHERE d.organization_id = c.organization_id
             AND d.deleted_at IS NULL
             AND lower(d.name) = lower(trim(c.department))),
         (SELECT d.id FROM "directory_person" AS p
            JOIN "department" AS d ON d.id = p.department_id
           WHERE p.organization_id = c.organization_id
             AND p.id = c.person_id
             AND d.deleted_at IS NULL),
         (SELECT d.id FROM "department" AS d
            JOIN "contact" AS k ON k.organization_id = d.organization_id
           WHERE k.id = c.contact_id
             AND d.deleted_at IS NULL
             AND lower(d.name) = lower(trim(k.department))),
         (SELECT d.id FROM "department" AS d
           WHERE d.organization_id = c.organization_id
             AND d.deleted_at IS NULL
             AND lower(d.name) = 'service courrier')
       ),
       updated_at = now()
 WHERE c.department_id IS NULL;--> statement-breakpoint
-- Open codes the trigger did not reach: a contact's takes the department of its
-- latest waiting parcel (§3.7.9). One already open there wins, as in the trigger.
UPDATE "pickup_code" AS code
   SET department_id = chosen.department_id, updated_at = now()
  FROM (
    SELECT open.id, coalesce(
      (SELECT p.department_id FROM "directory_person" AS p
        WHERE p.organization_id = open.organization_id AND p.id = open.person_id),
      (SELECT w.department_id FROM "parcel" AS w
        WHERE w.organization_id = open.organization_id
          AND w.contact_id = open.contact_id
          AND w.deleted_at IS NULL
          AND w.status IN ('a_completer', 'recu', 'notifie')
        ORDER BY w.id DESC LIMIT 1),
      (SELECT d.id FROM "department" AS d
        WHERE d.organization_id = open.organization_id
          AND d.deleted_at IS NULL
          AND lower(d.name) = 'service courrier')
    ) AS department_id
      FROM "pickup_code" AS open
     WHERE open.department_id IS NULL
       AND open.used_at IS NULL
       AND open.deleted_at IS NULL
  ) AS chosen
 WHERE code.id = chosen.id
   AND NOT EXISTS (
     SELECT 1 FROM "pickup_code" AS there
      WHERE there.used_at IS NULL
        AND there.deleted_at IS NULL
        AND there.department_id = chosen.department_id
        AND (there.person_id = code.person_id OR there.contact_id = code.contact_id)
   );--> statement-breakpoint
-- SMALL_SITE_OPERATING_PROFILE of @repo/contract (a test holds them equal). A
-- company that already chose one keeps it.
INSERT INTO "setting" (id, organization_id, key, value)
SELECT pg_temp.conversion_uuid7(), o.id, 'operatingProfile', '{"shuttleActsAsDepartment":true,"batchReview":"optional","depositConfirmation":"disabled","handoverProof":"optional","handoverScan":"disabled","signature":"optional","photo":"optional","emailMoment":"scan","reminders":"optional"}'::jsonb
  FROM "organization" AS o
 WHERE NOT EXISTS (
   SELECT 1 FROM "setting" AS s
    WHERE s.organization_id = o.id
      AND s.key = 'operatingProfile'
      AND s.deleted_at IS NULL
 );--> statement-breakpoint
-- A null role was read as `agent`. An unknown one stays: it reaches nothing now.
-- Sessions stay: the role is read at each request.
UPDATE "user"
   SET role = CASE WHEN role = 'admin' THEN 'company_admin' ELSE 'shuttle' END
 WHERE role IS NULL OR role IN ('admin', 'agent');
