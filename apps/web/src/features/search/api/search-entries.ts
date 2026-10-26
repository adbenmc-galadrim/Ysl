import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { CourrierDatabase } from '#/features/db/schema';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import {
  type SearchEntry,
  toSearchEntry,
} from '#/features/search/search-index';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * Every parcel on the iPhone, ready to be searched: read and normalized once
 * per change of the local database, never per keystroke. No server call.
 */
export async function listSearchEntries(
  database: CourrierDatabase,
  now = new Date(),
): Promise<SearchEntry[]> {
  const parcels = await database.parcel.toArray();
  const context = await loadRecipientContext(database, parcels);
  return parcels.flatMap(
    (parcel) => toSearchEntry(parcel, context, now, t) ?? [],
  );
}
