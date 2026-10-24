-- Why a write was refused (status 4xx): the constraint or guard that raised,
-- and what it saw. The conflict log of §8.4: `select * from sync_op where
-- status = 409`.
ALTER TABLE "sync_op" ADD COLUMN "reason" text;--> statement-breakpoint
-- Notifying or handing over needs someone to notify or hand over to. This
-- also means the SET NULL (person_id) and SET NULL (contact_id) of 0002 fail
-- on a parcel that is notifie or remis: a person or a contact with such a
-- parcel is deactivated, never deleted (the retention purge, YSL-55, will
-- have to delete the parcels first).
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_recipient_check" CHECK ("parcel"."status" not in ('notifie', 'remis') or num_nonnulls("parcel"."person_id", "parcel"."contact_id") = 1);
--> statement-breakpoint
-- The status graph of §8.3 (PARCEL_TRANSITIONS in src/schema/parcel.ts), and
-- the two guards of §8.4 on a delivery: a parcel handed over keeps its proof
-- (delivered_at, delivered_by) and leaves `remis` only through a cancelled
-- handover: one that lists it must carry cancelled_at, and none that lists it
-- may still be live (a logically deleted handover counts as live until it is
-- cancelled). A stale copy from a device that never saw the handover, or that
-- arrives before the handover itself, cannot undo it. The constraint name
-- tells sync.push which answer to give (409 for both guards).
CREATE FUNCTION "public"."parcel_status_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'a_completer' AND NEW.status = 'recu')
      OR (OLD.status = 'recu' AND NEW.status IN ('notifie', 'remis', 'retourne'))
      OR (OLD.status = 'notifie' AND NEW.status IN ('remis', 'retourne'))
      OR (OLD.status = 'remis' AND NEW.status = 'notifie')
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
  ELSIF OLD.status = 'remis'
     AND (NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
          OR NEW.delivered_by IS DISTINCT FROM OLD.delivered_by) THEN
    RAISE EXCEPTION 'the delivery of parcel % cannot change', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'parcel_delivery_protected';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- A cancelled handover stays cancelled: the trace of the cancellation
-- (§8.3, "remise annulée, tracée") survives a stale copy of the row. And a
-- handover keeps its parcels: taking one out would let the parcel leave
-- `remis` with no cancelled handover behind it.
CREATE FUNCTION "public"."handover_cancel_sticky"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    RAISE EXCEPTION 'handover % stays cancelled', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'handover_cancel_sticky';
  END IF;
  IF NOT (NEW.parcel_ids @> OLD.parcel_ids) THEN
    RAISE EXCEPTION 'handover % keeps its parcels', OLD.id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'handover_parcels_sticky';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "parcel_status_guard" BEFORE UPDATE OF "status", "delivered_at", "delivered_by" ON "parcel" FOR EACH ROW EXECUTE FUNCTION "public"."parcel_status_guard"();
--> statement-breakpoint
CREATE TRIGGER "handover_cancel_sticky" BEFORE UPDATE OF "cancelled_at", "parcel_ids" ON "handover" FOR EACH ROW EXECUTE FUNCTION "public"."handover_cancel_sticky"();
--> statement-breakpoint
ALTER TABLE "parcel" ENABLE ALWAYS TRIGGER "parcel_status_guard";
--> statement-breakpoint
ALTER TABLE "handover" ENABLE ALWAYS TRIGGER "handover_cancel_sticky";
