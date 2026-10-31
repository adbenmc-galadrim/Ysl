import type { AnyDb } from '@repo/db';
import type { Mailer } from '#features/mail/mailer';
import { drainEmailOutbox, type DrainCounts } from '#features/mail/queue';
import { requestDueReminders } from '#features/mail/server-reminders';
import { prepareServerMails } from '#features/mail/server-send';

const REMINDERS_EVERY_MS = 15 * 60_000;

/**
 * One turn of the mail job: the reminders due now and then, what the devices
 * asked for, what is due in the queue. Nothing here runs without the job, so
 * no key means no draw, no queue, no mail.
 */
export function mailRound(db: AnyDb, mailer: Mailer) {
  let remindersAt = 0;
  return async (signal: AbortSignal): Promise<DrainCounts> => {
    const now = new Date();
    if (now.getTime() - remindersAt >= REMINDERS_EVERY_MS) {
      remindersAt = now.getTime();
      await requestDueReminders(db, now);
    }
    await prepareServerMails(db, { now });
    return drainEmailOutbox(db, mailer, { signal });
  };
}
