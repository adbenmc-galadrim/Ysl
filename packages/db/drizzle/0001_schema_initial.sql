CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"email" text,
	"created_by" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "contact_id_v7" CHECK (coalesce(uuid_extract_version("contact"."id"), 0) = 7),
	CONSTRAINT "contact_usage_count_check" CHECK ("contact"."usage_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "directory_person" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"name_norm" text NOT NULL,
	"email" text NOT NULL,
	"department" text,
	"site" text,
	"source" text DEFAULT 'manuel' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "directory_person_id_v7" CHECK (coalesce(uuid_extract_version("directory_person"."id"), 0) = 7),
	CONSTRAINT "directory_person_source_check" CHECK ("directory_person"."source" in ('manuel', 'entra'))
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"at" timestamp with time zone NOT NULL,
	"detail" jsonb,
	CONSTRAINT "event_id_v7" CHECK (coalesce(uuid_extract_version("event"."id"), 0) = 7)
);
--> statement-breakpoint
CREATE TABLE "handover" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"parcel_ids" uuid[] NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"recipient_name" text NOT NULL,
	"delegate_name" text,
	"method" text NOT NULL,
	"agent_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "handover_id_v7" CHECK (coalesce(uuid_extract_version("handover"."id"), 0) = 7),
	CONSTRAINT "handover_method_check" CHECK ("handover"."method" in ('qr', 'pin', 'signature', 'manuel')),
	CONSTRAINT "handover_single_recipient" CHECK ("handover"."person_id" is null or "handover"."contact_id" is null),
	CONSTRAINT "handover_recipient_name_check" CHECK (btrim("handover"."recipient_name") <> ''),
	CONSTRAINT "handover_parcels_check" CHECK (cardinality("handover"."parcel_ids") >= 1),
	CONSTRAINT "handover_cancel_check" CHECK ("handover"."cancelled_at" is null or "handover"."cancelled_at" >= "handover"."at")
);
--> statement-breakpoint
CREATE TABLE "pickup_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"token_hash" text NOT NULL,
	"pin_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "pickup_code_id_v7" CHECK (coalesce(uuid_extract_version("pickup_code"."id"), 0) = 7),
	CONSTRAINT "pickup_code_single_recipient" CHECK (num_nonnulls("pickup_code"."person_id", "pickup_code"."contact_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "email_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"owner_id" text NOT NULL,
	CONSTRAINT "email_template_id_v7" CHECK (coalesce(uuid_extract_version("email_template"."id"), 0) = 7),
	CONSTRAINT "email_template_type_check" CHECK ("email_template"."type" in ('avis', 'relance', 'resume_service'))
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"type" text NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"recipients" text[] NOT NULL,
	"cc" text[] DEFAULT '{}'::text[] NOT NULL,
	"parcel_ids" uuid[] NOT NULL,
	"template_id" uuid,
	"prepared_at" timestamp with time zone NOT NULL,
	"prepared_by" text NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_id_v7" CHECK (coalesce(uuid_extract_version("notification"."id"), 0) = 7),
	CONSTRAINT "notification_type_check" CHECK ("notification"."type" in ('avis', 'relance', 'resume_service')),
	CONSTRAINT "notification_single_recipient" CHECK ("notification"."person_id" is null or "notification"."contact_id" is null),
	CONSTRAINT "notification_parcels_check" CHECK (cardinality("notification"."parcel_ids") >= 1),
	CONSTRAINT "notification_recipients_check" CHECK (cardinality("notification"."recipients") >= 1)
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"agent_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"parcel_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "batch_id_v7" CHECK (coalesce(uuid_extract_version("batch"."id"), 0) = 7),
	CONSTRAINT "batch_parcel_count_check" CHECK ("batch"."parcel_count" >= 0),
	CONSTRAINT "batch_period_check" CHECK ("batch"."ended_at" is null or "batch"."ended_at" >= "batch"."started_at")
);
--> statement-breakpoint
CREATE TABLE "parcel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"batch_id" uuid,
	"type" text DEFAULT 'colis' NOT NULL,
	"status" text NOT NULL,
	"carrier" text,
	"tracking" text,
	"tracking_norm" text,
	"person_id" uuid,
	"contact_id" uuid,
	"read_name" text,
	"notification_email" text,
	"department" text,
	"sender_id" uuid,
	"sender_name" text,
	"piece_n" integer,
	"piece_total" integer,
	"weight_kg" numeric(8, 3),
	"carrier_service" text,
	"reference" text,
	"location" text,
	"notes" text,
	"received_at" timestamp with time zone NOT NULL,
	"received_by" text NOT NULL,
	"validated_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivered_by" text,
	CONSTRAINT "parcel_id_v7" CHECK (coalesce(uuid_extract_version("parcel"."id"), 0) = 7),
	CONSTRAINT "parcel_type_check" CHECK ("parcel"."type" in ('colis', 'recommande', 'sans_suivi')),
	CONSTRAINT "parcel_status_check" CHECK ("parcel"."status" in ('a_completer', 'recu', 'notifie', 'remis', 'retourne')),
	CONSTRAINT "parcel_single_recipient" CHECK ("parcel"."person_id" is null or "parcel"."contact_id" is null),
	CONSTRAINT "parcel_delivery_check" CHECK (("parcel"."status" = 'remis') = ("parcel"."delivered_at" is not null and "parcel"."delivered_by" is not null)),
	CONSTRAINT "parcel_pieces_check" CHECK (("parcel"."piece_n" is null or "parcel"."piece_n" >= 1) and ("parcel"."piece_total" is null or ("parcel"."piece_total" >= 1 and ("parcel"."piece_n" is null or "parcel"."piece_n" <= "parcel"."piece_total")))),
	CONSTRAINT "parcel_weight_check" CHECK ("parcel"."weight_kg" is null or "parcel"."weight_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sender" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"display_name" text NOT NULL,
	"name_norm" text NOT NULL,
	"address" text,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "sender_id_v7" CHECK (coalesce(uuid_extract_version("sender"."id"), 0) = 7),
	CONSTRAINT "sender_seen_count_check" CHECK ("sender"."seen_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sender_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"carrier" text NOT NULL,
	"account_number" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sender_account_id_v7" CHECK (coalesce(uuid_extract_version("sender_account"."id"), 0) = 7),
	CONSTRAINT "sender_account_confirmations_check" CHECK ("sender_account"."confirmations" >= 0)
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_xid" bigint DEFAULT pg_current_xact_id()::text::bigint NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	CONSTRAINT "setting_id_v7" CHECK (coalesce(uuid_extract_version("setting"."id"), 0) = 7)
);
--> statement-breakpoint
CREATE TABLE "sync_op" (
	"organization_id" uuid NOT NULL,
	"op_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" smallint NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_op_organization_id_op_id_pk" PRIMARY KEY("organization_id","op_id"),
	CONSTRAINT "sync_op_entity_check" CHECK ("sync_op"."entity" in ('directory_person', 'contact', 'sender', 'sender_account', 'batch', 'parcel', 'email_template', 'notification', 'pickup_code', 'handover', 'event', 'setting'))
);
--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_person" ADD CONSTRAINT "directory_person_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender" ADD CONSTRAINT "sender_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_account" ADD CONSTRAINT "sender_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_op" ADD CONSTRAINT "sync_op_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_cursor_idx" ON "contact" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_organization_id_idx" ON "contact" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "contact_name_norm_idx" ON "contact" USING btree ("organization_id","name_norm" text_pattern_ops) WHERE "contact"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "contact_last_used_at_idx" ON "contact" USING btree ("organization_id","last_used_at");--> statement-breakpoint
CREATE INDEX "directory_person_cursor_idx" ON "directory_person" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "directory_person_organization_id_idx" ON "directory_person" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "directory_person_email_idx" ON "directory_person" USING btree ("organization_id",lower("email")) WHERE "directory_person"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "directory_person_name_norm_idx" ON "directory_person" USING btree ("organization_id","name_norm" text_pattern_ops) WHERE "directory_person"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "event_cursor_idx" ON "event" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "event_entity_id_idx" ON "event" USING btree ("entity_id","at");--> statement-breakpoint
CREATE INDEX "event_at_idx" ON "event" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX "handover_cursor_idx" ON "handover" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "handover_parcel_ids_idx" ON "handover" USING gin ("parcel_ids");--> statement-breakpoint
CREATE INDEX "handover_person_id_idx" ON "handover" USING btree ("person_id") WHERE "handover"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "handover_contact_id_idx" ON "handover" USING btree ("contact_id") WHERE "handover"."contact_id" is not null;--> statement-breakpoint
CREATE INDEX "handover_at_idx" ON "handover" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX "pickup_code_cursor_idx" ON "pickup_code" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_token_hash_idx" ON "pickup_code" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_person_idx" ON "pickup_code" USING btree ("person_id") WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_contact_idx" ON "pickup_code" USING btree ("contact_id") WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "pickup_code_person_id_idx" ON "pickup_code" USING btree ("organization_id","person_id") WHERE "pickup_code"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "pickup_code_contact_id_idx" ON "pickup_code" USING btree ("organization_id","contact_id") WHERE "pickup_code"."contact_id" is not null;--> statement-breakpoint
CREATE INDEX "pickup_code_expires_at_idx" ON "pickup_code" USING btree ("organization_id","expires_at");--> statement-breakpoint
CREATE INDEX "email_template_cursor_idx" ON "email_template" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_organization_id_idx" ON "email_template" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "email_template_owner_id_idx" ON "email_template" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_default_idx" ON "email_template" USING btree ("owner_id","type") WHERE "email_template"."is_default" and "email_template"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notification_cursor_idx" ON "notification" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE INDEX "notification_parcel_ids_idx" ON "notification" USING gin ("parcel_ids");--> statement-breakpoint
CREATE INDEX "notification_person_id_idx" ON "notification" USING btree ("person_id") WHERE "notification"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "notification_contact_id_idx" ON "notification" USING btree ("contact_id") WHERE "notification"."contact_id" is not null;--> statement-breakpoint
CREATE INDEX "notification_template_id_idx" ON "notification" USING btree ("template_id") WHERE "notification"."template_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_member_organization_user_idx" ON "organization_member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "batch_cursor_idx" ON "batch" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_organization_id_idx" ON "batch" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "parcel_cursor_idx" ON "parcel" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "parcel_organization_id_idx" ON "parcel" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "parcel_tracking_norm_idx" ON "parcel" USING btree ("organization_id","tracking_norm") WHERE "parcel"."tracking_norm" is not null;--> statement-breakpoint
CREATE INDEX "parcel_open_status_idx" ON "parcel" USING btree ("organization_id","status","received_at") WHERE "parcel"."deleted_at" is null and "parcel"."status" in ('a_completer', 'recu', 'notifie');--> statement-breakpoint
CREATE INDEX "parcel_overdue_idx" ON "parcel" USING btree ("organization_id",coalesce("last_notified_at", "notified_at")) WHERE "parcel"."deleted_at" is null and "parcel"."status" = 'notifie';--> statement-breakpoint
CREATE INDEX "parcel_batch_id_idx" ON "parcel" USING btree ("batch_id") WHERE "parcel"."batch_id" is not null;--> statement-breakpoint
CREATE INDEX "parcel_person_id_idx" ON "parcel" USING btree ("person_id") WHERE "parcel"."person_id" is not null;--> statement-breakpoint
CREATE INDEX "parcel_contact_id_idx" ON "parcel" USING btree ("contact_id") WHERE "parcel"."contact_id" is not null;--> statement-breakpoint
CREATE INDEX "parcel_sender_id_idx" ON "parcel" USING btree ("sender_id") WHERE "parcel"."sender_id" is not null;--> statement-breakpoint
CREATE INDEX "parcel_delivered_at_idx" ON "parcel" USING btree ("organization_id","delivered_at") WHERE "parcel"."delivered_at" is not null;--> statement-breakpoint
CREATE INDEX "sender_cursor_idx" ON "sender" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_organization_id_idx" ON "sender" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "sender_name_norm_idx" ON "sender" USING btree ("organization_id","name_norm" text_pattern_ops) WHERE "sender"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sender_account_cursor_idx" ON "sender_account" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_account_carrier_number_idx" ON "sender_account" USING btree ("organization_id",lower("carrier"),upper(regexp_replace("account_number", '[[:space:]]', '', 'g'))) WHERE "sender_account"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sender_account_sender_id_idx" ON "sender_account" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "setting_cursor_idx" ON "setting" USING btree ("organization_id","server_xid","id");--> statement-breakpoint
CREATE UNIQUE INDEX "setting_key_idx" ON "setting" USING btree ("organization_id","key") WHERE "setting"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sync_op_applied_at_idx" ON "sync_op" USING btree ("applied_at");