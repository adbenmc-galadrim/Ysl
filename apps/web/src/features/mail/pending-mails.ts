import { Dexie } from 'dexie';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  groupByRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import { parcelsOnServer } from '#/features/mail/server-mail';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';

/** The statuses a first notice can leave from (`noticeDue`). */
const NOTICE_STATUSES = ['recu', 'en_route', 'depose'] as const;

/** Every mail the parcels whose moment has come call for, one per recipient (F34); not those the server is sending. */
export async function loadPendingMails(
  db: CourrierDatabase,
): Promise<RecipientMail[]> {
  const candidates = await Promise.all(
    NOTICE_STATUSES.map((status) =>
      db.parcel
        .where('[status+receivedAt]')
        .between([status, Dexie.minKey], [status, Dexie.maxKey])
        .toArray(),
    ),
  );
  const onServer = await parcelsOnServer(db);
  const waiting = candidates
    .flat()
    .filter((parcel) => !onServer.has(parcel.id));
  return groupByRecipient(waiting, await loadRecipientContext(db, waiting));
}
