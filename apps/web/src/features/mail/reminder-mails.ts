import type { ReminderState } from '@repo/contract/reminders';
import { Dexie } from 'dexie';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  groupByRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { reminderOf } from '#/features/parcels/model';
import { loadReminderDates } from '#/features/parcels/reminders';

/**
 * One reminder to write (F37): a recipient's parcels a reminder is due
 * for or « en souffrance », with where each stands. `due`: at least one
 * calls for a reminder by the rule (D12); otherwise only late ones remain,
 * both reminders gone.
 */
export type ReminderMail = RecipientMail & {
  due: boolean;
  reminders: ReadonlyMap<string, ReminderState>;
};

/**
 * The reminders the notified parcels call for, one mail per recipient as
 * for the notices (D12), the most pressing first. Nothing leaves by itself
 * (D2): the app prepares, the agent sends.
 */
export async function loadReminderMails(
  db: CourrierDatabase,
  now = new Date(),
): Promise<ReminderMail[]> {
  const notified = await db.parcel
    .where('[status+receivedAt]')
    .between(['notifie', Dexie.minKey], ['notifie', Dexie.maxKey])
    .toArray();
  const [context, dates] = await Promise.all([
    loadRecipientContext(db, notified),
    loadReminderDates(db, notified),
  ]);
  const states = new Map(
    notified.flatMap((parcel): [string, ReminderState][] => {
      const state = reminderOf(parcel, now, dates);
      return state && (state.due || state.late) ? [[parcel.id, state]] : [];
    }),
  );
  const pending = (parcel: LocalParcel) =>
    states.has(parcel.id) &&
    (parcel.personId !== null || parcel.contactId !== null);
  return groupByRecipient(notified, context, pending)
    .map((mail) => {
      const reminders = new Map(
        mail.parcels.map((parcel) => [parcel.id, states.get(parcel.id)!]),
      );
      const due = [...reminders.values()].some((state) => state.due);
      return { ...mail, due, reminders };
    })
    .sort((a, b) => Number(b.due) - Number(a.due));
}

/** The people a reminder is due for, as the Colis banner counts them. */
export function dueCount(mails: readonly ReminderMail[]): number {
  return mails.filter((mail) => mail.due).length;
}
