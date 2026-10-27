import { internalTracking } from '@repo/contract/parcel-completion';
import type { CourrierDatabase } from '#/features/db/schema';

/**
 * A number for a parcel « Sans suivi » (§4.4) that no parcel nor draft on
 * this iPhone holds yet; 40 random bits make a clash elsewhere unlikely.
 */
export async function newInternalTracking(
  db: CourrierDatabase,
  draw: () => string = internalTracking,
): Promise<string> {
  for (;;) {
    const id = draw();
    const [parcels, drafts] = await Promise.all([
      db.parcel.where('trackingNorm').equals(id).count(),
      db.draftParcel.where('trackingNorm').equals(id).count(),
    ]);
    if (parcels === 0 && drafts === 0) return id;
  }
}
