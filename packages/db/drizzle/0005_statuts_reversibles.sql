-- F30: every step of §8.3 can be taken back (FORWARD_TRANSITIONS and
-- BACKWARD_TRANSITIONS of @repo/contract/parcel-status). A stale copy from a device must not pass for
-- an undo, so the status carries a counter: a device that changes the status
-- sends status_seq + 1. Rows already there start at 0; nothing else moves.
ALTER TABLE "parcel" ADD COLUMN "status_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_status_seq_check" CHECK ("parcel"."status_seq" >= 0);
--> statement-breakpoint
-- Forward, a change without the counter is still taken (an app from before
-- this migration never sends it) and the server moves the counter itself. A
-- step back needs the counter: the copy has to have seen the status it
-- leaves. Any other counter is a copy that missed a change: refused in 409
-- (parcel_status_stale), which also stops a stale `remis` from undoing a
-- cancelled handover. Leaving `remis`, back to `notifie` or to `recu`, still
-- needs a cancelled handover (0004). When the status stays, the counter stays
-- too: a copy cannot move it without a change of status. A copy that sends
-- the old counter unchanged reads as an app without one (sync.push leaves a
-- column it was not sent alone).
CREATE OR REPLACE FUNCTION "public"."parcel_status_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  step_back boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    step_back := (OLD.status = 'recu' AND NEW.status = 'a_completer')
      OR (OLD.status = 'notifie' AND NEW.status = 'recu')
      OR (OLD.status IN ('remis', 'retourne') AND NEW.status IN ('notifie', 'recu'));
    IF NOT (
      step_back
      OR (OLD.status = 'a_completer' AND NEW.status = 'recu')
      OR (OLD.status = 'recu' AND NEW.status IN ('notifie', 'remis', 'retourne'))
      OR (OLD.status = 'notifie' AND NEW.status IN ('remis', 'retourne'))
    ) THEN
      RAISE EXCEPTION 'parcel % cannot go from % to %', OLD.id, OLD.status, NEW.status
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_transition';
    END IF;
    IF OLD.status = 'remis' AND (
      EXISTS (
        SELECT 1 FROM "public"."handover"
         WHERE "public"."handover".organization_id = OLD.organization_id
           AND "public"."handover".parcel_ids @> ARRAY[OLD.id]
           AND "public"."handover".cancelled_at IS NULL
      )
      OR NOT EXISTS (
        SELECT 1 FROM "public"."handover"
         WHERE "public"."handover".organization_id = OLD.organization_id
           AND "public"."handover".parcel_ids @> ARRAY[OLD.id]
           AND "public"."handover".cancelled_at IS NOT NULL
      )
    ) THEN
      RAISE EXCEPTION 'parcel % is handed over: cancel the handover first', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_delivery_protected';
    END IF;
    IF NEW.status_seq = OLD.status_seq AND NOT step_back THEN
      NEW.status_seq := OLD.status_seq + 1;
    ELSIF NEW.status_seq IS DISTINCT FROM OLD.status_seq + 1 THEN
      RAISE EXCEPTION 'parcel % changed status since this copy (status_seq % sent, % expected)',
        OLD.id, NEW.status_seq, OLD.status_seq + 1
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_status_stale';
    END IF;
  ELSE
    NEW.status_seq := OLD.status_seq;
    IF OLD.status = 'remis'
       AND (NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
            OR NEW.delivered_by IS DISTINCT FROM OLD.delivered_by) THEN
      RAISE EXCEPTION 'the delivery of parcel % cannot change', OLD.id
        USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_delivery_protected';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER "parcel_status_guard" ON "parcel";
--> statement-breakpoint
CREATE TRIGGER "parcel_status_guard" BEFORE UPDATE OF "status", "status_seq", "delivered_at", "delivered_by" ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_status_guard"();
--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ALWAYS TRIGGER "parcel_status_guard";
