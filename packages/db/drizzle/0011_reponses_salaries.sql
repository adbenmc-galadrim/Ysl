-- YSL-70: the recipient's answer to the pickup e-mail, as the agent reports
-- it (the app reads no mail, D2). The reply codes are REPLY_KINDS of
-- @repo/contract/parcel-reply; each answer is also a `parcel.reply` event.
-- Rows already there carry none.
ALTER TABLE "parcel" ADD COLUMN "reply" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "expected_delegate" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "reminders_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_reply_check" CHECK (("parcel"."reply" is null or "parcel"."reply" in ('not_mine', 'colleague', 'absent')) and ("parcel"."reply" is null) = ("parcel"."replied_at" is null));