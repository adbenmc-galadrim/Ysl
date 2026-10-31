import type { AnyDb } from '@repo/db';
import type { Mailer } from '#features/mail/mailer';
import { drainEmailOutbox, type DrainCounts } from '#features/mail/queue';
import { prepareServerMails } from '#features/mail/server-send';

/**
 * One turn of the mail job: what the devices asked for, what is due in the queue. Nothing here runs without the job, so
 * no key means no draw, no queue, no mail.
 */
export function mailRound(db: AnyDb, mailer: Mailer) {
  return async (signal: AbortSignal): Promise<DrainCounts> => {
    const now = new Date();
    await prepareServerMails(db, { now });
    return drainEmailOutbox(db, mailer, { signal });
  };
}
