import { Dexie } from 'dexie';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  groupByRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';

/** Every mail the « Reçu » parcels call for, one per recipient (F34). */
export async function loadPendingMails(
  db: CourrierDatabase,
): Promise<RecipientMail[]> {
  const received = await db.parcel
    .where('[status+receivedAt]')
    .between(['recu', Dexie.minKey], ['recu', Dexie.maxKey])
    .toArray();
  return groupByRecipient(received, await loadRecipientContext(db, received));
}
