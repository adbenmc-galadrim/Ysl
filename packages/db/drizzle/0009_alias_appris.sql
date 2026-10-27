CREATE TABLE "recipient_alias" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"name_norm" text NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"confirmations" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "recipient_alias_id_v7" CHECK (coalesce(uuid_extract_version("recipient_alias"."id"), 0) = 7),
	CONSTRAINT "recipient_alias_target_check" CHECK (num_nonnulls("recipient_alias"."person_id", "recipient_alias"."contact_id") = 1),
	CONSTRAINT "recipient_alias_confirmations_check" CHECK ("recipient_alias"."confirmations" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sender_alias" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"alias_norm" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"confirmations" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "sender_alias_id_v7" CHECK (coalesce(uuid_extract_version("sender_alias"."id"), 0) = 7),
	CONSTRAINT "sender_alias_confirmations_check" CHECK ("sender_alias"."confirmations" >= 1)
);
--> statement-breakpoint
ALTER TABLE "sync_op" DROP CONSTRAINT "sync_op_entity_check";--> statement-breakpoint
ALTER TABLE "sender_account" ADD COLUMN "challenger_id" uuid;--> statement-breakpoint
ALTER TABLE "sender_account" ADD COLUMN "challenges" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipient_alias" ADD CONSTRAINT "recipient_alias_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_alias" ADD CONSTRAINT "sender_alias_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipient_alias_cursor_idx" ON "recipient_alias" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "recipient_alias_name_norm_idx" ON "recipient_alias" USING btree ("organization_id","name_norm") WHERE "recipient_alias"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "recipient_alias_person_id_idx" ON "recipient_alias" USING btree ("person_id") WHERE "recipient_alias"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "recipient_alias_contact_id_idx" ON "recipient_alias" USING btree ("contact_id") WHERE "recipient_alias"."contact_id" is not null;--> statement-breakpoint
CREATE INDEX "sender_alias_cursor_idx" ON "sender_alias" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "sender_alias_alias_norm_idx" ON "sender_alias" USING btree ("organization_id","alias_norm") WHERE "sender_alias"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sender_alias_sender_id_idx" ON "sender_alias" USING btree ("sender_id");--> statement-breakpoint
ALTER TABLE "sender_account" ADD CONSTRAINT "sender_account_challenges_check" CHECK ("sender_account"."challenges" >= 0);--> statement-breakpoint
ALTER TABLE "sync_op" ADD CONSTRAINT "sync_op_entity_check" CHECK ("sync_op"."entity" in ('directory_person', 'contact', 'sender', 'sender_account', 'batch', 'parcel', 'email_template', 'notification', 'pickup_code', 'handover', 'event', 'setting', 'sender_alias', 'recipient_alias'));--> statement-breakpoint
-- What the agent's corrections teach (§4.8, YSL-60): the OCR text of a FROM
-- block taken for a sender, and a printed name taken for a card. Synced like
-- the rest: their own server_xid triggers, and the composite foreign keys of
-- 0002 to their parent in the same mailroom. No unique index: two iPhones
-- learning the same name offline both keep their row, the reader takes the
-- most confirmed one.
CREATE TRIGGER "sender_alias_stamp_server_xid_insert" BEFORE INSERT ON "sender_alias" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE TRIGGER "sender_alias_stamp_server_xid_update" BEFORE UPDATE ON "sender_alias" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE TRIGGER "recipient_alias_stamp_server_xid_insert" BEFORE INSERT ON "recipient_alias" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
CREATE TRIGGER "recipient_alias_stamp_server_xid_update" BEFORE UPDATE ON "recipient_alias" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();--> statement-breakpoint
ALTER TABLE "sender_alias" ADD CONSTRAINT "sender_alias_sender_id_fk" FOREIGN KEY ("organization_id","sender_id") REFERENCES "sender"("organization_id","id") ON DELETE NO ACTION;--> statement-breakpoint
ALTER TABLE "recipient_alias" ADD CONSTRAINT "recipient_alias_person_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "directory_person"("organization_id","id") ON DELETE NO ACTION;--> statement-breakpoint
ALTER TABLE "recipient_alias" ADD CONSTRAINT "recipient_alias_contact_id_fk" FOREIGN KEY ("organization_id","contact_id") REFERENCES "contact"("organization_id","id") ON DELETE NO ACTION;--> statement-breakpoint
ALTER TABLE "sender_account" ADD CONSTRAINT "sender_account_challenger_id_fk" FOREIGN KEY ("organization_id","challenger_id") REFERENCES "sender"("organization_id","id") ON DELETE SET NULL ("challenger_id");
