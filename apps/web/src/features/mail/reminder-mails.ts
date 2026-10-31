import { reminderMode } from '@repo/contract/operating-profile';
import type { ReminderState } from '@repo/contract/reminders';
import type { TranslateFn } from '@repo/shared/i18n';
import type { ReminderPerson } from '@repo/ui';
import { Dexie } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db as appDb } from '#/features/db/database';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  parcelsOnServer,
  serverMailOn,
  waitingOnServer,
} from '#/features/mail/server-mail';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import {
  groupByRecipient,
  parcelName,
  type RecipientMail,
} from '#/features/mail/recipients';
import {
  loadRecipientContext,
  useMinuteClock,
} from '#/features/parcels/api/use-parcels';
import { DAY_MS, reminderOf, shortDate } from '#/features/parcels/model';
import { loadReminderDates } from '#/features/parcels/reminders';

/**
 * One reminder to write (F37): a recipient's parcels a reminder is due
 * for or « en souffrance », with where each stands. `due`: at least one
 * calls for a reminder by the rule (D12); otherwise only late ones remain,
 * both reminders gone.
 */
export type ReminderMail = RecipientMail & {
  due: boolean;
  /** The last mail that left bounced: the address first, no reminder to it. */
  bounced: boolean;
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
  const onServer = await parcelsOnServer(db, now);
  // Automatic (§3.7.9): the server reminds whom it told, until only the alert is left.
  const automatic =
    (await serverMailOn(db)) &&
    reminderMode((await readOperatingProfile(db)).reminders) === 'automatic';
  const mailsAboutThem = (await db.notification.toArray()).filter(
    (row) => !row.deletedAt,
  );
  const aboutParcel = (parcelId: string) =>
    mailsAboutThem.filter((row) => row.parcelIds.includes(parcelId));
  const lastSent = (parcelId: string) =>
    aboutParcel(parcelId)
      .filter((row) => row.sentAt)
      .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())[0];
  const serverReminds = (parcel: LocalParcel) =>
    automatic &&
    !states.get(parcel.id)?.late &&
    lastSent(parcel.id)?.deliveryStatus !== 'bounced' &&
    // Given up on, or stuck, at the server: the phone is the way left.
    !aboutParcel(parcel.id).some(
      (row) =>
        row.channel === 'server' &&
        row.type === 'relance' &&
        row.preparedAt > (lastSent(parcel.id)?.sentAt ?? parcel.notifiedAt!) &&
        (row.status === 'failed' ||
          (row.status === 'prepared' && !waitingOnServer(row, now))),
    ) &&
    aboutParcel(parcel.id).some(
      (row) => row.channel === 'server' && row.type === 'avis' && row.sentAt,
    );
  const pending = (parcel: LocalParcel) =>
    states.has(parcel.id) &&
    !onServer.has(parcel.id) &&
    !serverReminds(parcel) &&
    (parcel.personId !== null || parcel.contactId !== null);
  return groupByRecipient(notified, context, pending)
    .map((mail) => {
      const reminders = new Map(
        mail.parcels.map((parcel) => [parcel.id, states.get(parcel.id)!]),
      );
      const bounced = mail.parcels.some(
        (parcel) => lastSent(parcel.id)?.deliveryStatus === 'bounced',
      );
      const due = !bounced && [...reminders.values()].some((s) => s.due);
      return { ...mail, due, bounced, reminders };
    })
    .sort((a, b) => Number(b.due) - Number(a.due));
}

/** The people a reminder is due for, as the Colis banner counts them. */
export function dueCount(mails: readonly ReminderMail[]): number {
  return mails.filter((mail) => mail.due).length;
}

/** The reminders as they stand, moved on with the clock and the database. */
export function useReminderMails(): ReminderMail[] | undefined {
  const now = useMinuteClock();
  return useLiveQuery(() => loadReminderMails(appDb, now), [now]);
}

/**
 * One person on the screen of the parcels nobody came for: their parcels,
 * since when the oldest waits, and the reminders already sent.
 */
export function describeReminder(
  mail: ReminderMail,
  now: Date,
  t: TranslateFn,
): ReminderPerson {
  const states = [...mail.reminders.values()];
  const firstNotice = Math.min(
    ...mail.parcels.map((parcel) =>
      (parcel.notifiedAt ?? parcel.receivedAt).getTime(),
    ),
  );
  const days = Math.floor((now.getTime() - firstNotice) / DAY_MS);
  const sent = Math.max(0, ...states.map((state) => state.sent));
  const last = states
    .filter((state) => state.sent > 0)
    .reduce<Date | null>(
      (latest, state) => (!latest || state.last > latest ? state.last : latest),
      null,
    );
  return {
    id: mail.key,
    name: mail.name,
    parcels: t('remind.row.parcels', {
      count: mail.parcels.length,
      names: mail.parcels.map((parcel) => parcelName(parcel, t)).join(', '),
    }),
    status: mail.bounced
      ? t('remind.row.bounced')
      : sent && last
        ? t('remind.row.reminded', {
            days,
            count: sent,
            date: shortDate(last, now),
          })
        : t('remind.row.never', { days }),
    due: mail.due,
  };
}

export type ReminderSection = {
  title: string;
  actionLabel?: string;
  people: { mail: ReminderMail; person: ReminderPerson }[];
};

/**
 * The screen's sections: a reminder due, both sent and still waiting, then
 * whoever has no address, whatever their rhythm (YSL-72): « Prévenir » there,
 * never part of « Relancer les N ».
 */
export function reminderSections(
  mails: readonly ReminderMail[],
  now: Date,
  t: TranslateFn,
): ReminderSection[] {
  const people = mails.map((mail) => ({
    mail,
    person: describeReminder(mail, now, t),
  }));
  const reachable = people.filter(({ mail }) => mail.address && !mail.bounced);
  return [
    {
      title: t('remind.section.bounced'),
      actionLabel: t('remind.row.fix'),
      people: people.filter(({ mail }) => mail.address && mail.bounced),
    },
    {
      title: t('remind.section.due'),
      people: reachable.filter(({ mail }) => mail.due),
    },
    {
      title: t('remind.section.late'),
      people: reachable.filter(({ mail }) => !mail.due),
    },
    {
      title: t('remind.section.otherWay'),
      actionLabel: t('colis.row.otherWay'),
      people: people.filter(({ mail }) => !mail.address),
    },
  ];
}
