CREATE TABLE "platform_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"company_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "platform_journal_action_check" CHECK ("platform_journal"."action" in ('company_created', 'company_renamed', 'company_suspended', 'company_reactivated', 'company_deleted', 'company_admin_invited', 'company_admin_invite_refused'))
);
--> statement-breakpoint
CREATE INDEX "platform_journal_at_idx" ON "platform_journal" USING btree ("at");--> statement-breakpoint
CREATE INDEX "platform_journal_company_idx" ON "platform_journal" USING btree ("company_id","at");