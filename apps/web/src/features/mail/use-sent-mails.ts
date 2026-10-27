import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  lastMailFailed,
  latestMail,
  staleMails,
  trackMails,
  type TrackedMail,
} from '#/features/mail/tracking';
import {
  loadRecipientContext,
  useMinuteClock,
} from '#/features/parcels/api/use-parcels';
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

export type MailNotes = {
  /** Parcels whose latest mail, whoever wrote it, did not go. */
  failed: ReadonlySet<string>;
  /** The agent's mails left unanswered for ten minutes. */
  stale: number;
};

/** What the parcel list says of the mails: live, and moved on each minute. */
export function useMailNotes(): MailNotes | undefined {
  const userId = useSession().user.id;
  const now = useMinuteClock();
  return useLiveQuery(async () => {
    const rows = await db.notification.toArray();
    // Only the unanswered mails are counted here, and they do not depend
    // on their parcels: the failures, closed for want of parcels, are not read.
    const mails = trackMails(rows, { userId, parcels: new Map() });
    return {
      failed: lastMailFailed(rows),
      stale: staleMails(mails, now).length,
    };
  }, [userId, now]);
}

/** The latest mail about one parcel, for its record. */
export function useLatestMail(parcelId: string) {
  return useLiveQuery(
    async () => latestMail(await db.notification.toArray(), parcelId) ?? null,
    [parcelId],
  );
}
