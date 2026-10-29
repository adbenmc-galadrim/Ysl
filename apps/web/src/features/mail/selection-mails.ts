import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  groupByRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';

/**
 * The mails of parcels ticked on Colis (F31), one per person, those
 * parcels only: notices take the received and notified ones (a person's
 * notice also reminds), reminders the notified ones alone.
 */
export async function loadSelectionMails(
  db: CourrierDatabase,
  parcelIds: readonly string[],
  reminder: boolean,
): Promise<RecipientMail[]> {
  const parcels = (await db.parcel.bulkGet([...parcelIds])).filter(
    (parcel): parcel is LocalParcel => parcel !== undefined,
  );
  const context = await loadRecipientContext(db, parcels);
  return groupByRecipient(
    parcels,
    context,
    (parcel) =>
      !parcel.deletedAt &&
      (parcel.personId !== null || parcel.contactId !== null) &&
      (parcel.status === 'notifie' || (!reminder && parcel.status === 'recu')),
  );
}
