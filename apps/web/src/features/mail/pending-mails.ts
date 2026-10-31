import { Dexie } from 'dexie';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  groupByRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import { parcelsOnServer } from '#/features/mail/server-mail';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';

/** Every mail the « Reçu » parcels call for, one per recipient (F34); not those the server is sending. */
export async function loadPendingMails(
  db: CourrierDatabase,
): Promise<RecipientMail[]> {
  const received = await db.parcel
    .where('[status+receivedAt]')
    .between(['recu', Dexie.minKey], ['recu', Dexie.maxKey])
    .toArray();
  const onServer = await parcelsOnServer(db);
  const waiting = received.filter((parcel) => !onServer.has(parcel.id));
  return groupByRecipient(waiting, await loadRecipientContext(db, waiting));
}
