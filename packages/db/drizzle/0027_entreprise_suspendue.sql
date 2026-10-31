ALTER TABLE "organization" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "reactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "profile_model" text;