ALTER TABLE "email_outbox" ADD COLUMN "notification_id" uuid;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_outbox_provider_message_id_idx" ON "email_outbox" USING btree ("provider_message_id") WHERE "email_outbox"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "email_outbox_notification_id_idx" ON "email_outbox" USING btree ("notification_id") WHERE "email_outbox"."notification_id" is not null;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_delivery_status_check" CHECK ("email_outbox"."delivery_status" in ('delivered', 'unsubscribed', 'complained', 'bounced'));--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_delivery_status_check" CHECK ("notification"."delivery_status" in ('delivered', 'unsubscribed', 'complained', 'bounced'));