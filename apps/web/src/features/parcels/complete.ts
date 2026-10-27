import type { CourrierDatabase } from '#/features/db/schema';
import {
  editOf,
  type EditOptions,
  type EditResult,
  type RecipientChoice,
  saveParcelEdit,
} from '#/features/parcels/edit';
import { liveParcel } from '#/features/parcels/status';

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
