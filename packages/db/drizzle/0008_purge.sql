-- The retention purges (§9.2, YSL-55), one row per mailroom and run: what
-- was marked deleted_at and what was erased, per table. horizon_xid is one
-- past the newest server_xid among the rows a run erased: a sync.pull whose
-- cursor is below the largest horizon of its mailroom may have missed a
-- deletion, and starts over (reset).
CREATE TABLE "purge_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"user_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"horizon_xid" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "purge_run_trigger_check" CHECK ("purge_run"."trigger" in ('auto', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "purge_run" ADD CONSTRAINT "purge_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purge_run_started_at_idx" ON "purge_run" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE INDEX "purge_run_horizon_idx" ON "purge_run" USING btree ("organization_id","horizon_xid");