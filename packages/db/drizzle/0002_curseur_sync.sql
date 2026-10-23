CREATE FUNCTION "public"."bump_server_seq"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.server_seq := nextval('sync_seq');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "directory_person_bump_server_seq" BEFORE INSERT OR UPDATE ON "directory_person" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "contact_bump_server_seq" BEFORE INSERT OR UPDATE ON "contact" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_bump_server_seq" BEFORE INSERT OR UPDATE ON "sender" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "sender_account_bump_server_seq" BEFORE INSERT OR UPDATE ON "sender_account" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "batch_bump_server_seq" BEFORE INSERT OR UPDATE ON "batch" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "parcel_bump_server_seq" BEFORE INSERT OR UPDATE ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "email_template_bump_server_seq" BEFORE INSERT OR UPDATE ON "email_template" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "notification_bump_server_seq" BEFORE INSERT OR UPDATE ON "notification" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "pickup_code_bump_server_seq" BEFORE INSERT OR UPDATE ON "pickup_code" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "handover_bump_server_seq" BEFORE INSERT OR UPDATE ON "handover" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "event_bump_server_seq" BEFORE INSERT OR UPDATE ON "event" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
--> statement-breakpoint
CREATE TRIGGER "setting_bump_server_seq" BEFORE INSERT OR UPDATE ON "setting" FOR EACH ROW EXECUTE FUNCTION "public"."bump_server_seq"();
