import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { trackMails, type TrackedMail } from '#/features/mail/tracking';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import type { RecipientContext } from '#/features/parcels/model';

export type SentMails = {
  mails: TrackedMail[];
  parcels: ReadonlyMap<string, LocalParcel>;
  context: RecipientContext;
};

/** The agent's mails and every parcel they name, read from the iPhone. */
export async function loadSentMails(
  database: CourrierDatabase,
  userId: string,
): Promise<SentMails> {
  const rows = await database.notification.toArray();
  const ids = [...new Set(rows.flatMap((row) => row.parcelIds))];
  const found = (await database.parcel.bulkGet(ids)).flatMap(
    (parcel) => parcel ?? [],
  );
  const parcels = new Map(found.map((parcel) => [parcel.id, parcel]));
  return {
    mails: trackMails(rows, { userId, parcels }),
    parcels,
    context: await loadRecipientContext(database, found),
  };
}

/** The sending log of the signed-in agent, live. */
export function useSentMails(): SentMails | undefined {
  const userId = useSession().user.id;
  return useLiveQuery(() => loadSentMails(db, userId), [userId]);
}
