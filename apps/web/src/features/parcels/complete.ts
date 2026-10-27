import { type ParcelGap, parcelGaps } from '@repo/contract/parcel-completion';
import type { ParcelEditField } from '@repo/contract/parcel-event';
import { type ParcelStatus, statusPatch } from '@repo/contract/parcel-status';
import { normalizeTracking } from '@repo/contract/tracking';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  editOf,
  type EditOptions,
  type EditResult,
  isComplete,
  type RecipientChoice,
  saveParcelEdit,
} from '#/features/parcels/edit';
import { parcelEvent } from '#/features/parcels/events';
import { newInternalTracking } from '#/features/parcels/internal-tracking';
import { liveParcel } from '#/features/parcels/status';

/** What a recorded parcel lacks to be notified (F26): someone set, a number, its carrier. */
export function gapsOf(
  parcel: Pick<
    LocalParcel,
    'type' | 'carrier' | 'tracking' | 'personId' | 'contactId'
  >,
): ParcelGap[] {
  return parcelGaps({
    type: parcel.type,
    carrier: parcel.carrier,
    tracking: parcel.tracking,
    recipient: Boolean(parcel.personId || parcel.contactId),
  });
}

/**
 * The recipient chosen for a recorded parcel outside its form — the
 * « Choisir » of Colis, the record's « Compléter »: saved as the form would
 * (contact typed, lesson learned, history), and the parcel leaves
 * « À compléter » when nothing else is missing.
 */
export async function assignRecipient(
  db: CourrierDatabase,
  parcelId: string,
  recipient: RecipientChoice,
  options: EditOptions,
): Promise<EditResult> {
  const parcel = await liveParcel(db, parcelId);
  return saveParcelEdit(
    db,
    parcelId,
    { ...editOf(parcel), recipient },
    options,
  );
}

/** The number of a recorded parcel as the agent completes it (§4.4). */
export type TrackingInput =
  | { kind: 'tracked'; tracking: string; carrier: string }
  /** « Sans suivi »: the app numbers the parcel, no carrier. */
  | { kind: 'untracked' };

/**
 * The number completed on a parcel « À compléter » from its record: typed
 * with its carrier, kept as it was (the agent vouches for it), or
 * « Sans suivi ». The agent's word is a confirmation (F26): the parcel is
 * « Reçu » when someone is set for it too, else it stays « À compléter ».
 * Returns the status it ends in.
 */
export async function completeTracking(
  db: CourrierDatabase,
  parcelId: string,
  input: TrackingInput,
  { agentId, now = new Date() }: EditOptions,
): Promise<ParcelStatus> {
  const parcel = await liveParcel(db, parcelId);
  const options = { agentId, now };
  const tracked =
    input.kind === 'tracked'
      ? {
          type: parcel.type === 'sans_suivi' ? ('colis' as const) : parcel.type,
          tracking: normalizeTracking(input.tracking) || null,
          carrier: input.carrier.trim() || null,
        }
      : {
          type: 'sans_suivi' as const,
          tracking:
            parcel.type === 'sans_suivi' && parcel.tracking
              ? parcel.tracking
              : await newInternalTracking(db),
          carrier: null,
        };
  const edited: LocalParcel = {
    ...parcel,
    ...tracked,
    trackingNorm: tracked.tracking,
  };
  const fields: ParcelEditField[] = [
    ...(edited.tracking !== parcel.tracking ? (['tracking'] as const) : []),
    ...(edited.carrier !== parcel.carrier ? (['carrier'] as const) : []),
  ];
  const to =
    parcel.status === 'a_completer' && isComplete(edited) ? 'recu' : undefined;
  if (fields.length === 0 && edited.type === parcel.type && !to) {
    return parcel.status;
  }
  const row = to ? { ...edited, ...statusPatch(edited, to, options) } : edited;
  const upserts: Upsert[] = [
    { entity: 'parcel', row },
    ...(fields.length
      ? [parcelEvent(parcelId, { type: 'parcel.edited', fields }, options)]
      : []),
    ...(to
      ? [
          parcelEvent(
            parcelId,
            { type: 'parcel.status', from: parcel.status, to },
            options,
          ),
        ]
      : []),
  ];
  await commitLocal(db, { upserts }, { now });
  return row.status;
}
