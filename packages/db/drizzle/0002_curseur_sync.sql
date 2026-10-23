-- server_seq is the sync.pull cursor of an organization. Numbers are taken
-- under a per-organization transaction lock, so they follow commit order: a
-- pull can never see a number while a smaller one is still uncommitted.
CREATE FUNCTION "public"."bump_server_seq"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(7417, hashtext(NEW.organization_id::text));
  NEW.server_seq := nextval('sync_seq');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION "public"."event_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.organization_id, OLD.entity, OLD.entity_id, OLD.type, OLD.actor_id, OLD.at, OLD.detail)
     IS DISTINCT FROM
     (NEW.organization_id, NEW.entity, NEW.entity_id, NEW.type, NEW.actor_id, NEW.at, NEW.detail) THEN
    RAISE EXCEPTION 'event % is append-only', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "directory_person_bump_server_seq_insert" BEFORE INSERT ON "directory_person" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "directory_person_bump_server_seq_update" BEFORE UPDATE ON "directory_person" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "contact_bump_server_seq_insert" BEFORE INSERT ON "contact" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "contact_bump_server_seq_update" BEFORE UPDATE ON "contact" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_bump_server_seq_insert" BEFORE INSERT ON "sender" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_bump_server_seq_update" BEFORE UPDATE ON "sender" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_account_bump_server_seq_insert" BEFORE INSERT ON "sender_account" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_account_bump_server_seq_update" BEFORE UPDATE ON "sender_account" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "batch_bump_server_seq_insert" BEFORE INSERT ON "batch" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "batch_bump_server_seq_update" BEFORE UPDATE ON "batch" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "parcel_bump_server_seq_insert" BEFORE INSERT ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "parcel_bump_server_seq_update" BEFORE UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "email_template_bump_server_seq_insert" BEFORE INSERT ON "email_template" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "email_template_bump_server_seq_update" BEFORE UPDATE ON "email_template" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "notification_bump_server_seq_insert" BEFORE INSERT ON "notification" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "notification_bump_server_seq_update" BEFORE UPDATE ON "notification" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "pickup_code_bump_server_seq_insert" BEFORE INSERT ON "pickup_code" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "pickup_code_bump_server_seq_update" BEFORE UPDATE ON "pickup_code" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "handover_bump_server_seq_insert" BEFORE INSERT ON "handover" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "handover_bump_server_seq_update" BEFORE UPDATE ON "handover" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "event_bump_server_seq_insert" BEFORE INSERT ON "event" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "event_bump_server_seq_update" BEFORE UPDATE ON "event" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "setting_bump_server_seq_insert" BEFORE INSERT ON "setting" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "setting_bump_server_seq_update" BEFORE UPDATE ON "setting" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "event_immutable" BEFORE UPDATE ON "event" FOR EACH ROW EXECUTE FUNCTION "public"."event_immutable"();
