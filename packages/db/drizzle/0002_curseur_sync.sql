-- Sync cursor. Every write stamps the row with the id of its transaction
-- (server_xid). A pull from cursor C returns, for one organization, the rows
-- with C <= server_xid < X, where X = pg_snapshot_xmin(pg_current_snapshot())
-- taken by the pull, and X becomes the next cursor. Every transaction below X
-- has ended, so no commit can land behind the cursor; rows of transactions
-- above X come with the next pull. Nothing is locked or serialized.
CREATE FUNCTION "public"."stamp_server_xid"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id of % % cannot change', TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.server_xid := pg_current_xact_id()::text::bigint;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- The event log is append-only. Retention purges (YSL-55) delete in a
-- transaction that first runs set_config('app.purge', 'on', true); no update,
-- ever.
CREATE FUNCTION "public"."event_append_only"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR current_setting('app.purge', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'event is append-only' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION "public"."check_parcel_ids"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF array_ndims(NEW.parcel_ids) <> 1
     OR cardinality(NEW.parcel_ids) <> (SELECT count(DISTINCT listed) FROM unnest(NEW.parcel_ids) AS listed) THEN
    RAISE EXCEPTION '% % lists a parcel twice', TG_TABLE_NAME, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.parcel_ids) AS listed(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM "public"."parcel"
        WHERE "public"."parcel".id = listed.id
          AND "public"."parcel".organization_id = NEW.organization_id
     )
  ) THEN
    RAISE EXCEPTION '% % lists a parcel outside its organization', TG_TABLE_NAME, NEW.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "directory_person_stamp_server_xid_insert" BEFORE INSERT ON "directory_person" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "directory_person_stamp_server_xid_update" BEFORE UPDATE ON "directory_person" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "contact_stamp_server_xid_insert" BEFORE INSERT ON "contact" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "contact_stamp_server_xid_update" BEFORE UPDATE ON "contact" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "sender_stamp_server_xid_insert" BEFORE INSERT ON "sender" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "sender_stamp_server_xid_update" BEFORE UPDATE ON "sender" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "sender_account_stamp_server_xid_insert" BEFORE INSERT ON "sender_account" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "sender_account_stamp_server_xid_update" BEFORE UPDATE ON "sender_account" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "batch_stamp_server_xid_insert" BEFORE INSERT ON "batch" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "batch_stamp_server_xid_update" BEFORE UPDATE ON "batch" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "parcel_stamp_server_xid_insert" BEFORE INSERT ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "parcel_stamp_server_xid_update" BEFORE UPDATE ON "parcel" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "email_template_stamp_server_xid_insert" BEFORE INSERT ON "email_template" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "email_template_stamp_server_xid_update" BEFORE UPDATE ON "email_template" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "notification_stamp_server_xid_insert" BEFORE INSERT ON "notification" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "notification_stamp_server_xid_update" BEFORE UPDATE ON "notification" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "pickup_code_stamp_server_xid_insert" BEFORE INSERT ON "pickup_code" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "pickup_code_stamp_server_xid_update" BEFORE UPDATE ON "pickup_code" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "handover_stamp_server_xid_insert" BEFORE INSERT ON "handover" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "handover_stamp_server_xid_update" BEFORE UPDATE ON "handover" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "event_stamp_server_xid_insert" BEFORE INSERT ON "event" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "event_stamp_server_xid_update" BEFORE UPDATE ON "event" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "setting_stamp_server_xid_insert" BEFORE INSERT ON "setting" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "setting_stamp_server_xid_update" BEFORE UPDATE ON "setting" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION "public"."stamp_server_xid"();
--> statement-breakpoint
CREATE TRIGGER "event_append_only" BEFORE UPDATE OR DELETE ON "event" FOR EACH ROW EXECUTE FUNCTION "public"."event_append_only"();
--> statement-breakpoint
CREATE TRIGGER "event_append_only_truncate" BEFORE TRUNCATE ON "event" FOR EACH STATEMENT EXECUTE FUNCTION "public"."event_append_only"();
--> statement-breakpoint
CREATE TRIGGER "handover_check_parcel_ids" BEFORE INSERT OR UPDATE OF "parcel_ids", "organization_id" ON "handover" FOR EACH ROW EXECUTE FUNCTION "public"."check_parcel_ids"();
--> statement-breakpoint
CREATE TRIGGER "notification_check_parcel_ids" BEFORE INSERT OR UPDATE OF "parcel_ids", "organization_id" ON "notification" FOR EACH ROW EXECUTE FUNCTION "public"."check_parcel_ids"();
--> statement-breakpoint
-- Foreign keys carry organization_id, so a row can only reference rows of its
-- own organization. Drizzle cannot express SET NULL (column), hence plain SQL.
ALTER TABLE "contact" ADD CONSTRAINT "contact_created_by_fk" FOREIGN KEY ("organization_id","created_by") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "sender_account" ADD CONSTRAINT "sender_account_sender_id_fk" FOREIGN KEY ("organization_id","sender_id") REFERENCES "sender"("organization_id","id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_agent_id_fk" FOREIGN KEY ("organization_id","agent_id") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_batch_id_fk" FOREIGN KEY ("organization_id","batch_id") REFERENCES "batch"("organization_id","id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_person_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "directory_person"("organization_id","id") ON DELETE SET NULL ("person_id");
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_contact_id_fk" FOREIGN KEY ("organization_id","contact_id") REFERENCES "contact"("organization_id","id") ON DELETE SET NULL ("contact_id");
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_sender_id_fk" FOREIGN KEY ("organization_id","sender_id") REFERENCES "sender"("organization_id","id") ON DELETE SET NULL ("sender_id");
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_received_by_fk" FOREIGN KEY ("organization_id","received_by") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_delivered_by_fk" FOREIGN KEY ("organization_id","delivered_by") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_owner_id_fk" FOREIGN KEY ("organization_id","owner_id") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_person_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "directory_person"("organization_id","id") ON DELETE SET NULL ("person_id");
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_contact_id_fk" FOREIGN KEY ("organization_id","contact_id") REFERENCES "contact"("organization_id","id") ON DELETE SET NULL ("contact_id");
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_template_id_fk" FOREIGN KEY ("organization_id","template_id") REFERENCES "email_template"("organization_id","id") ON DELETE SET NULL ("template_id");
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_prepared_by_fk" FOREIGN KEY ("organization_id","prepared_by") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_person_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "directory_person"("organization_id","id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "pickup_code" ADD CONSTRAINT "pickup_code_contact_id_fk" FOREIGN KEY ("organization_id","contact_id") REFERENCES "contact"("organization_id","id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_person_id_fk" FOREIGN KEY ("organization_id","person_id") REFERENCES "directory_person"("organization_id","id") ON DELETE SET NULL ("person_id");
--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_contact_id_fk" FOREIGN KEY ("organization_id","contact_id") REFERENCES "contact"("organization_id","id") ON DELETE SET NULL ("contact_id");
--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_agent_id_fk" FOREIGN KEY ("organization_id","agent_id") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_actor_id_fk" FOREIGN KEY ("organization_id","actor_id") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "setting" ADD CONSTRAINT "setting_updated_by_fk" FOREIGN KEY ("organization_id","updated_by") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
ALTER TABLE "sync_op" ADD CONSTRAINT "sync_op_user_id_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "organization_member"("organization_id","user_id") ON DELETE NO ACTION;
--> statement-breakpoint
-- Triggers also fire under session_replication_role = replica (pg_restore
-- --disable-triggers, data fixes): the cursor and the guards never skip a write.
ALTER TABLE "directory_person" ENABLE ALWAYS TRIGGER "directory_person_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "directory_person" ENABLE ALWAYS TRIGGER "directory_person_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "contact" ENABLE ALWAYS TRIGGER "contact_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "contact" ENABLE ALWAYS TRIGGER "contact_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "sender" ENABLE ALWAYS TRIGGER "sender_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "sender" ENABLE ALWAYS TRIGGER "sender_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "sender_account" ENABLE ALWAYS TRIGGER "sender_account_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "sender_account" ENABLE ALWAYS TRIGGER "sender_account_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "batch" ENABLE ALWAYS TRIGGER "batch_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "batch" ENABLE ALWAYS TRIGGER "batch_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ALWAYS TRIGGER "parcel_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ALWAYS TRIGGER "parcel_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "email_template" ENABLE ALWAYS TRIGGER "email_template_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "email_template" ENABLE ALWAYS TRIGGER "email_template_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ALWAYS TRIGGER "notification_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ALWAYS TRIGGER "notification_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "pickup_code" ENABLE ALWAYS TRIGGER "pickup_code_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "pickup_code" ENABLE ALWAYS TRIGGER "pickup_code_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "handover" ENABLE ALWAYS TRIGGER "handover_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "handover" ENABLE ALWAYS TRIGGER "handover_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "event" ENABLE ALWAYS TRIGGER "event_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "event" ENABLE ALWAYS TRIGGER "event_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "setting" ENABLE ALWAYS TRIGGER "setting_stamp_server_xid_insert";
--> statement-breakpoint
ALTER TABLE "setting" ENABLE ALWAYS TRIGGER "setting_stamp_server_xid_update";
--> statement-breakpoint
ALTER TABLE "event" ENABLE ALWAYS TRIGGER "event_append_only";
--> statement-breakpoint
ALTER TABLE "event" ENABLE ALWAYS TRIGGER "event_append_only_truncate";
--> statement-breakpoint
ALTER TABLE "handover" ENABLE ALWAYS TRIGGER "handover_check_parcel_ids";
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ALWAYS TRIGGER "notification_check_parcel_ids";
