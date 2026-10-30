ALTER TABLE "handover" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "handover" ADD COLUMN "cancel_note" text;--> statement-breakpoint
ALTER TABLE "handover" ADD COLUMN "cancelled_by_name" text;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_cancel_reason_check" CHECK ("handover"."cancel_reason" in ('wrong_parcel', 'wrong_person', 'entry_error'));--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_cancel_reason_cancelled" CHECK ("handover"."cancel_reason" is null or "handover"."cancelled_at" is not null);--> statement-breakpoint
-- F44: only the handover that wrote `delivered_at` holds the parcel. One that
-- lost this parcel to another iPhone, kept for the parcels it did hand over,
-- lists it too and must not stop the right handover from being undone.
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
           AND "public"."handover".at = OLD.delivered_at
           AND "public"."handover".cancelled_at IS NULL
      )
      OR NOT EXISTS (
        SELECT 1 FROM "public"."handover"
         WHERE "public"."handover".organization_id = OLD.organization_id
           AND "public"."handover".parcel_ids @> ARRAY[OLD.id]
           AND "public"."handover".at = OLD.delivered_at
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
