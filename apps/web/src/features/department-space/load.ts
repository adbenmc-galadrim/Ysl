import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { CourrierDatabase } from '#/features/db/schema';
import { type SpaceParcel, tabOf } from '#/features/department-space/space';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { loadReminderDates } from '#/features/parcels/reminders';
import { toSearchEntry } from '#/features/search/search-index';

const t = createTranslator(DEFAULT_LOCALE);

/** Every parcel of the department on this device, handed over ones included (D7). */
export async function loadSpace(
  database: CourrierDatabase,
  now: Date,
): Promise<SpaceParcel[]> {
  const parcels = await database.parcel.toArray();
  const [context, dates] = await Promise.all([
    loadRecipientContext(database, parcels),
    loadReminderDates(database, parcels),
  ]);
  return parcels.flatMap((parcel) => {
    const entry = toSearchEntry(parcel, context, now, t, dates);
    return entry
      ? [
          {
            parcel,
            tab: tabOf(parcel.status, context.tour === true),
            entry,
            handover: context.handovers?.get(parcel.id),
          },
        ]
      : [];
  });
}
