import {
  SERVER_MAIL_WAIT_MS,
  type NotificationType,
} from '@repo/contract/mail';
import { newId } from '@repo/shared/id';
import { useLiveQuery } from 'dexie-react-hooks';
import { commitLocal } from '#/features/db/commit';
import { db as appDb } from '#/features/db/database';
import {
  SYNC_STATE_KEYS,
  type CourrierDatabase,
  type LocalNotification,
} from '#/features/db/schema';

/** What the last pull said: without a yes, the mail app does the work, as before (D2). */
export async function serverMailOn(db: CourrierDatabase): Promise<boolean> {
  return (await db.syncState.get(SYNC_STATE_KEYS.serverMail))?.value === true;
}

export function useServerMail(): boolean | undefined {
  return useLiveQuery(() => serverMailOn(appDb), []);
}

/** A request the server holds and has not answered: it does not ask twice. */
export function waitingOnServer(row: LocalNotification, now: Date): boolean {
  return (
    row.channel === 'server' &&
    row.status === 'prepared' &&
    !row.deletedAt &&
    now.getTime() - row.preparedAt.getTime() < SERVER_MAIL_WAIT_MS
  );
}

/**
 * The parcels a mail of the server is on its way for: no second mail from this
 * iPhone. Past the wait, or with the server's sending off, they go back to the
 * phone; the server checks again before it sends, so nothing leaves twice.
 */
export async function parcelsOnServer(
  db: CourrierDatabase,
  now = new Date(),
): Promise<Set<string>> {
  if (!(await serverMailOn(db))) return new Set();
  const recent = await db.notification
    .where('preparedAt')
    .above(new Date(now.getTime() - SERVER_MAIL_WAIT_MS))
    .toArray();
  return new Set(
    recent.flatMap((row) => (waitingOnServer(row, now) ? row.parcelIds : [])),
  );
}

export type ServerMailRequest = {
  personId: string | null;
  contactId: string | null;
  address: string | null;
  parcels: readonly { id: string }[];
};

/**
 * Asks the server for these mails, by the sync so it holds offline. Neither code
 * nor text: the server draws the one and writes the other. Whoever has no
 * address stays with the phone's ways of telling them. Returns how many asked.
 */
export async function requestServerMails(
  db: CourrierDatabase,
  mails: readonly ServerMailRequest[],
  type: Extract<NotificationType, 'avis' | 'relance'>,
  { userId, now = new Date() }: { userId: string; now?: Date },
): Promise<number> {
  const rows = mails.flatMap((mail): LocalNotification[] =>
    mail.address && mail.parcels.length > 0
      ? [
          {
            id: newId(),
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            type,
            personId: mail.personId,
            contactId: mail.personId ? null : mail.contactId,
            recipients: [mail.address],
            cc: [],
            parcelIds: mail.parcels.map(({ id }) => id),
            templateId: null,
            status: 'prepared',
            target: null,
            preparedAt: now,
            preparedBy: userId,
            openedAt: null,
            sentAt: null,
            failedReason: null,
            relayName: null,
            channel: 'server',
          },
        ]
      : [],
  );
  if (rows.length === 0) return 0;
  await commitLocal(
    db,
    { upserts: rows.map((row) => ({ entity: 'notification' as const, row })) },
    { now },
  );
  return rows.length;
}
