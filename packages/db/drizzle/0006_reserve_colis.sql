-- YSL-53: a reserve on the parcel's state (zone d'ombre « Colis abîmé »).
-- The reason codes are DAMAGE_REASONS of @repo/contract/parcel-damage; a
-- lifted reserve clears the columns, its events stay in `event`. Rows
-- already there carry none.
ALTER TABLE "parcel" ADD COLUMN "damage" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "damage_note" text;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "damage_notify" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "damage_carrier_reserve" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parcel" ADD COLUMN "damaged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcel" ADD CONSTRAINT "parcel_damage_check" CHECK (("parcel"."damage" is null or "parcel"."damage" in ('carton_abime', 'ouvert', 'mouille', 'contenu_casse', 'autre')) and ("parcel"."damage" is null) = ("parcel"."damaged_at" is null));