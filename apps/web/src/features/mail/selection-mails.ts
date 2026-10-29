import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  drawSecrets,
  type PickupSecret,
  recallSecrets,
} from '#/features/mail/pickup-code';
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

/**
 * The codes the selection's mails quote, in their order: a reminder quotes
 * the code its recipient already holds (F37), a notice a new one.
 */
export function selectionSecrets(
  db: CourrierDatabase,
  mails: readonly RecipientMail[],
  reminder: boolean,
  now: Date,
): Promise<PickupSecret[]> {
  return reminder
    ? recallSecrets(db, mails, { now })
    : drawSecrets(db, mails.length, { now });
}
