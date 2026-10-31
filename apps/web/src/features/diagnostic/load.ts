import { cutoff } from '@repo/contract/retention';
import { currentRetention } from '#/features/settings/company-snapshot';
import { extractionOf } from '#/features/batch/extraction';
import type { CourrierDatabase, LocalExtraction } from '#/features/db/schema';
import { findLabelPhoto } from '#/features/parcels/api/parcel-record';

/** Why a parcel has no reading to show. */
export type NoReading = 'never' | 'purged' | 'elsewhere' | 'missing';

/**
 * What the reader made of a label, wherever it is: kept with the parcel
 * since « Terminer », scored on the spot for a draft of the batch in
 * progress, or nothing, and why.
 */
export type Reading =
  | {
      kind: 'stored' | 'draft';
      extraction: LocalExtraction;
      photoId: string | null;
    }
  | { kind: 'none'; reason: NoReading };

/**
 * The reading of a parcel or of a draft (a draft keeps its id as a parcel).
 * Without a row: a parcel outside any batch was imported or entered by
 * hand; one received over 30 days ago lost it to the purge (§9.2); a newer
 * one was read on another iPhone, which kept it (the reading stays local).
 */
export async function loadReading(
  db: CourrierDatabase,
  id: string,
  now = new Date(),
): Promise<Reading> {
  const extraction = await db.extraction.get(id);
  if (extraction) {
    const photo = await findLabelPhoto(db, id);
    return { kind: 'stored', extraction, photoId: photo?.id ?? null };
  }
  const draft = await db.draftParcel.get(id);
  if (draft) {
    return {
      kind: 'draft',
      extraction: extractionOf(draft, now),
      photoId: draft.photoId,
    };
  }
  const parcel = await db.parcel.get(id);
  if (!parcel || parcel.deletedAt) return { kind: 'none', reason: 'missing' };
  if (!parcel.batchId) return { kind: 'none', reason: 'never' };
  if (parcel.receivedAt < cutoff(now, currentRetention().extraction)) {
    return { kind: 'none', reason: 'purged' };
  }
  return { kind: 'none', reason: 'elsewhere' };
}
