import type { NotificationStatus } from '@repo/contract/mail';
import type { TranslateFn } from '@repo/shared/i18n';
import type { LocalNotification, LocalParcel } from '#/features/db/schema';
import { statusOf } from '#/features/mail/notifications';
import {
  departmentOfParcel,
  namedRecipient,
  type RecipientMail,
} from '#/features/mail/recipients';
import {
  carrierLabel,
  recipientOf,
  type RecipientContext,
} from '#/features/parcels/model';
import { formatWhen, type WhenKeys } from '#/features/parcels/record';

/**
 * Where a mail stands for the agent who wrote it. Through the mail app, the
 * app only knows it opened (D2); the provider's webhook, for a mail sent by the
 * server, says what became of it. `waiting`: prepared or opened, and nobody
 * answered "did it leave?"; `failed`: the agent said no, or the provider
 * bounced it, and nothing replaced it; `sent`: the agent said yes, and no bounce
 * says otherwise; `closed`: a failure
 * that a later mail of the same parcels took over, or whose parcels all
 * moved on, so there is nothing left to resend.
 */
export type TrackedState = 'waiting' | 'failed' | 'sent' | 'closed';

export type TrackedMail = {
  notification: LocalNotification;
  status: NotificationStatus;
  state: TrackedState;
  /** For a closed failure: the later mail that took over, if any. */
  resentAt: Date | null;
};

export const MAIL_FILTERS = ['all', 'toConfirm', 'failed', 'sent'] as const;

export type MailFilter = (typeof MAIL_FILTERS)[number];

/** A mail app left open this long without an answer is worth a reminder. */
export const STALE_OPEN_MS = 10 * 60 * 1000;

function newestFirst(a: LocalNotification, b: LocalNotification): number {
  return b.preparedAt.getTime() - a.preparedAt.getTime();
}

/** The provider refused the address, whatever the agent declared. */
function bounced(notification: LocalNotification): boolean {
  return notification.deliveryStatus === 'bounced';
}

/**
 * What a new mail could still tell: the parcels waiting for a first notice,
 * and after a bounce those marked notified, whose recipient heard nothing.
 */
function stillToTell(
  notification: LocalNotification,
  parcel: LocalParcel | undefined,
): parcel is LocalParcel {
  if (!parcel || parcel.deletedAt) return false;
  if (parcel.status === 'recu') return true;
  return bounced(notification) && parcel.status === 'notifie';
}

/**
 * The mails of one agent, newest first: only the one whose mail app opened
 * a draft can say whether it left, and the server lets nobody else write
 * the row. A failure is closed once a later mail carries one of its
 * parcels, or once none of them waits for a notice any more (`parcels`:
 * those of the mails, by id; a missing one counts as moved on).
 */
export function trackMails(
  rows: readonly LocalNotification[],
  {
    userId,
    parcels,
  }: { userId: string; parcels: ReadonlyMap<string, LocalParcel> },
): TrackedMail[] {
  const mine = rows
    .filter((row) => !row.deletedAt && row.preparedBy === userId)
    .sort(newestFirst);
  return mine.map((notification) => {
    const status = statusOf(notification);
    if (status === 'sent' && !bounced(notification))
      return { notification, status, state: 'sent', resentAt: null };
    if (status !== 'failed' && !bounced(notification))
      return { notification, status, state: 'waiting', resentAt: null };
    const later = mine.find(
      (other) =>
        other.preparedAt > notification.preparedAt &&
        other.parcelIds.some((id) => notification.parcelIds.includes(id)) &&
        // A reminder to the same address would bounce too: it fixes nothing.
        (!bounced(notification) ||
          other.recipients[0] !== notification.recipients[0]),
    );
    const settled = !notification.parcelIds.some((id) =>
      stillToTell(notification, parcels.get(id)),
    );
    return {
      notification,
      status,
      state: later || settled ? 'closed' : 'failed',
      resentAt: later?.preparedAt ?? null,
    };
  });
}

const FILTERED: Record<MailFilter, readonly TrackedState[]> = {
  all: ['waiting', 'failed', 'sent', 'closed'],
  toConfirm: ['waiting'],
  failed: ['failed'],
  sent: ['sent'],
};

export function filterMails(
  mails: readonly TrackedMail[],
  filter: MailFilter,
  parcelId?: string,
): TrackedMail[] {
  return mails.filter(
    (mail) =>
      FILTERED[filter].includes(mail.state) &&
      (!parcelId || mail.notification.parcelIds.includes(parcelId)),
  );
}

export type MailCounts = { toConfirm: number; failed: number };

export function countMails(mails: readonly TrackedMail[]): MailCounts {
  return {
    toConfirm: mails.filter((mail) => mail.state === 'waiting').length,
    failed: mails.filter((mail) => mail.state === 'failed').length,
  };
}

/** When the mail app last took over for this mail, or when it was prepared. */
export function openedSince(notification: LocalNotification): Date {
  return notification.openedAt ?? notification.preparedAt;
}

/**
 * The mails left unanswered for more than ten minutes: the app was likely
 * killed between the mail app and the question (YSL-61), and the parcels
 * still read "À notifier" although the mail may have left.
 */
export function staleMails(
  mails: readonly TrackedMail[],
  now: Date,
): TrackedMail[] {
  return mails.filter(
    (mail) =>
      mail.state === 'waiting' &&
      now.getTime() - openedSince(mail.notification).getTime() >= STALE_OPEN_MS,
  );
}

/**
 * The parcels whose latest mail, whoever wrote it, was declared not sent or
 * bounced: they say why (a declared failure leaves them "À notifier").
 */
export function lastMailFailed(
  rows: readonly LocalNotification[],
): Set<string> {
  const latest = new Map<string, LocalNotification>();
  for (const row of rows) {
    if (row.deletedAt) continue;
    for (const parcelId of row.parcelIds) {
      const known = latest.get(parcelId);
      if (!known || row.preparedAt > known.preparedAt)
        latest.set(parcelId, row);
    }
  }
  return new Set(
    [...latest]
      .filter(([, row]) => statusOf(row) === 'failed' || bounced(row))
      .map(([parcelId]) => parcelId),
  );
}

/** The newest mail naming this parcel, whoever wrote it. */
export function latestMail(
  rows: readonly LocalNotification[],
  parcelId: string,
): LocalNotification | undefined {
  return rows
    .filter((row) => !row.deletedAt && row.parcelIds.includes(parcelId))
    .sort(newestFirst)[0];
}

/** "Envoyé à 10 h 58", "Non envoyé": where a parcel's last mail stands. */
export function lastMailLine(
  notification: LocalNotification,
  now: Date,
  t: TranslateFn,
): string {
  if (bounced(notification)) return t('mails.status.bounced');
  switch (statusOf(notification)) {
    case 'sent':
      return sentLine(notification, now, t);
    case 'failed':
      return t('mails.status.failed');
    case 'opened':
      return t('mails.last.opened');
    case 'prepared':
      return t('mails.last.prepared');
  }
}

const MAIL_WHEN: WhenKeys = {
  today: 'mails.when.today',
  yesterday: 'mails.when.yesterday',
  day: 'mails.when.before',
};

/** "à 10 h 58" today, "hier à 9 h 00", "le 14 oct. à 9 h 00" before. */
function when(date: Date, now: Date, t: TranslateFn): string {
  return formatWhen(date, now, t, MAIL_WHEN);
}

function sentLine(
  notification: LocalNotification,
  now: Date,
  t: TranslateFn,
): string {
  const { deliveryStatus, deliveryAt } = notification;
  if (deliveryStatus && deliveryStatus !== 'bounced' && deliveryAt) {
    return t(`mails.status.${deliveryStatus}`, {
      when: when(deliveryAt, now, t),
    });
  }
  return t('mails.status.sent', {
    when: when(notification.sentAt ?? notification.preparedAt, now, t),
  });
}

/** "2 colis Amazon", "Relance, 1 colis FedEx", "3 colis" across carriers. */
export function mailSummary(
  notification: LocalNotification,
  parcels: ReadonlyMap<string, LocalParcel>,
  t: TranslateFn,
): string {
  const known = notification.parcelIds.flatMap((id) => parcels.get(id) ?? []);
  const carriers = new Set(known.map((parcel) => carrierLabel(parcel, t)));
  const count = notification.parcelIds.length;
  const what =
    carriers.size === 1
      ? t('mails.summary.carrier', { count, carrier: [...carriers][0]! })
      : t('mails.summary', { count });
  return notification.type === 'relance'
    ? t('mails.summary.reminder', { what })
    : what;
}

/** What the row says of where the mail stands, dated. */
export function mailStatusLine(
  mail: TrackedMail,
  now: Date,
  t: TranslateFn,
): string {
  const { notification } = mail;
  switch (mail.state) {
    case 'sent':
      return sentLine(notification, now, t);
    case 'waiting':
      return mail.status === 'opened'
        ? t('mails.status.opened', {
            when: when(openedSince(notification), now, t),
          })
        : t('mails.status.prepared', {
            when: when(notification.preparedAt, now, t),
          });
    case 'failed':
      return bounced(notification)
        ? t('mails.status.bounced')
        : (notification.failedReason ?? t('mails.status.failed'));
    case 'closed':
      return mail.resentAt
        ? t('mails.status.resent', { when: when(mail.resentAt, now, t) })
        : t('mails.status.settled');
  }
}

/**
 * The mail a past notification stands for, to write it again: same person
 * or contact, the parcels of it still waiting for a notice, the address it
 * went to. Named as the directory or the contact card names them today.
 */
export function mailOf(
  notification: LocalNotification,
  parcels: ReadonlyMap<string, LocalParcel>,
  context: RecipientContext,
): RecipientMail {
  const waiting = notification.parcelIds.flatMap((id) => {
    const parcel = parcels.get(id);
    return stillToTell(notification, parcel) ? [parcel] : [];
  });
  const person = notification.personId
    ? context.people.get(notification.personId)
    : undefined;
  const contact = notification.contactId
    ? context.contacts.get(notification.contactId)
    : waiting[0]
      ? recipientOf(waiting[0], context).contact
      : undefined;
  const named = namedRecipient(person, notification.contactId, contact);
  return {
    key: notification.id,
    ...named,
    name: named.name || (notification.recipients[0] ?? ''),
    personId: notification.personId,
    contactId: notification.contactId,
    address: notification.recipients[0] ?? null,
    departmentId: waiting[0] ? departmentOfParcel(waiting[0], person) : null,
    parcels: waiting,
  };
}
