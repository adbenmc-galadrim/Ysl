ALTER TABLE "notification" ADD COLUMN "status" text DEFAULT 'prepared' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "failed_reason" text;--> statement-breakpoint
-- A mail already marked sent (before S5 nothing else could be told) stays sent.
UPDATE "notification" SET "status" = 'sent' WHERE "sent_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_status_check" CHECK ("notification"."status" in ('prepared', 'opened', 'sent', 'failed'));--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_target_check" CHECK ("notification"."target" in ('mailto', 'outlook', 'gmail'));--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_sent_check" CHECK (("notification"."status" = 'sent') = ("notification"."sent_at" is not null));--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_failed_check" CHECK ("notification"."status" = 'failed' or "notification"."failed_reason" is null);