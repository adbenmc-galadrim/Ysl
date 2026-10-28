ALTER TABLE "handover" ADD COLUMN "agent_name" text;--> statement-breakpoint
-- The handovers written before the column: named after their agent's account,
-- re-stamped so every iPhone pulls the name.
UPDATE "handover" SET "agent_name" = "user"."name" FROM "user" WHERE "user"."id" = "handover"."agent_id" AND btrim("user"."name") <> '';
