CREATE TABLE "sync_generation" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	"restored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_generation_single_row" CHECK ("sync_generation"."id" = 1)
);
--> statement-breakpoint
-- The one generation the cursors belong to. After a restore that sets the
-- transaction counter back (pg_dump/restore, PITR, new host), run
-- `update sync_generation set generation = gen_random_uuid(), restored_at = now()`:
-- every device then starts a full pull instead of pulling nothing forever.
INSERT INTO "sync_generation" ("id") VALUES (1);
