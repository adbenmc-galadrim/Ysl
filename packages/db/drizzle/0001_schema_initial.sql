CREATE TYPE "public"."directory_source" AS ENUM('manuel', 'csv', 'entra');--> statement-breakpoint
CREATE TYPE "public"."handover_method" AS ENUM('qr', 'pin', 'signature', 'manuel');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('avis', 'relance', 'resume_service');--> statement-breakpoint
CREATE TYPE "public"."parcel_status" AS ENUM('a_completer', 'recu', 'notifie', 'remis', 'retourne');--> statement-breakpoint
CREATE TYPE "public"."parcel_type" AS ENUM('colis', 'recommande', 'sans_suivi');--> statement-breakpoint
CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"created_by" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "directory_person" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"last_name" text NOT NULL,
	"first_name" text NOT NULL,
	"email" text NOT NULL,
	"department" text,
	"site" text,
	"source" "directory_source" NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"at" timestamp with time zone NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "handover" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"parcel_ids" uuid[] NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"delegate_name" text,
	"method" "handover_method" NOT NULL,
	"signature_photo_id" uuid,
	"agent_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "handover_single_recipient" CHECK ("handover"."person_id" is null or "handover"."contact_id" is null)
);
--> statement-breakpoint
CREATE TABLE "pickup_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"token_hash" text NOT NULL,
	"pin_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "pickup_code_single_recipient" CHECK (num_nonnulls("pickup_code"."person_id", "pickup_code"."contact_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "email_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"type" "notification_type" NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"owner_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"type" "notification_type" NOT NULL,
	"person_id" uuid,
	"contact_id" uuid,
	"recipients" text[] NOT NULL,
	"cc" text[] DEFAULT '{}'::text[] NOT NULL,
	"parcel_ids" uuid[] NOT NULL,
	"template_id" uuid,
	"prepared_at" timestamp with time zone NOT NULL,
	"prepared_by" text NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_single_recipient" CHECK ("notification"."person_id" is null or "notification"."contact_id" is null)
);
--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"agent_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"parcel_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"batch_id" uuid,
	"type" "parcel_type" DEFAULT 'colis' NOT NULL,
	"status" "parcel_status" NOT NULL,
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
	"delivered_at" timestamp with time zone,
	"delivered_by" text,
	CONSTRAINT "parcel_single_recipient" CHECK ("parcel"."person_id" is null or "parcel"."contact_id" is null)
);
--> statement-breakpoint
CREATE TABLE "sender" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"display_name" text NOT NULL,
	"name_norm" text NOT NULL,
	"address" text,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sender_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"carrier" text NOT NULL,
	"account_number" text NOT NULL,
	"sender_id" uuid NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_person_id_directory_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."directory_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_person_id_directory_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."directory_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_person_id_directory_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."directory_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_template_id_email_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_prepared_by_user_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_person_id_directory_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."directory_person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_sender_id_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."sender"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_received_by_user_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_delivered_by_user_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender_account" ADD CONSTRAINT "sender_account_sender_id_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."sender"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_server_seq_idx" ON "contact" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "directory_person_server_seq_idx" ON "directory_person" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "directory_person_email_idx" ON "directory_person" USING btree (lower("email")) WHERE "directory_person"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "event_server_seq_idx" ON "event" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "event_entity_idx" ON "event" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "handover_server_seq_idx" ON "handover" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "handover_parcel_ids_idx" ON "handover" USING gin ("parcel_ids");--> statement-breakpoint
CREATE INDEX "pickup_code_server_seq_idx" ON "pickup_code" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_token_hash_idx" ON "pickup_code" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_person_idx" ON "pickup_code" USING btree ("person_id") WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "pickup_code_active_contact_idx" ON "pickup_code" USING btree ("contact_id") WHERE "pickup_code"."used_at" is null and "pickup_code"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "email_template_server_seq_idx" ON "email_template" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "email_template_owner_id_idx" ON "email_template" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_template_default_idx" ON "email_template" USING btree ("owner_id","type") WHERE "email_template"."is_default" and "email_template"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notification_server_seq_idx" ON "notification" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "notification_parcel_ids_idx" ON "notification" USING gin ("parcel_ids");--> statement-breakpoint
CREATE INDEX "batch_server_seq_idx" ON "batch" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "parcel_server_seq_idx" ON "parcel" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "parcel_tracking_norm_idx" ON "parcel" USING btree ("tracking_norm");--> statement-breakpoint
CREATE INDEX "parcel_batch_id_idx" ON "parcel" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "parcel_person_id_idx" ON "parcel" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "parcel_contact_id_idx" ON "parcel" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "parcel_sender_id_idx" ON "parcel" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "sender_server_seq_idx" ON "sender" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "sender_name_norm_idx" ON "sender" USING btree ("name_norm");--> statement-breakpoint
CREATE INDEX "sender_account_server_seq_idx" ON "sender_account" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_account_carrier_number_idx" ON "sender_account" USING btree ("carrier","account_number") WHERE "sender_account"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "setting_server_seq_idx" ON "setting" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "setting_key_idx" ON "setting" USING btree ("key") WHERE "setting"."deleted_at" is null;