import { type ParcelGap, parcelGaps } from '@repo/contract/parcel-completion';
import { DAMAGE_LABEL, damageOf } from '@repo/contract/parcel-damage';
import { reminderState, type ReminderState } from '@repo/contract/reminders';
import type { TranslateFn } from '@repo/shared/i18n';
import type { Parcel as ParcelRow, ParcelState } from '@repo/ui';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export type RecipientContext = {
  people: ReadonlyMap<string, LocalDirectoryPerson>;
  contacts: ReadonlyMap<string, LocalContact>;
};

export function startOfDay(now: Date): Date {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

function firstNotification(parcel: LocalParcel): Date {
  return parcel.notifiedAt ?? parcel.receivedAt;
}

function lastNotification(parcel: LocalParcel): Date {
  return parcel.lastNotifiedAt ?? firstNotification(parcel);
}

/** The reminders each parcel had, from the sent mails on the iPhone (`loadReminderDates`). */
export type ReminderDates = ReadonlyMap<string, readonly Date[]>;

/**
 * Where a notified parcel stands with its reminders (F37, D12), by the
 * rule of `@repo/contract/reminders`. The sent mails on the iPhone date
 * the reminders; without them, a reminder later than the notice still
 * counts once (`lastNotifiedAt`).
 */
export function reminderOf(
  parcel: LocalParcel,
  now: Date,
  dates?: ReminderDates,
): ReminderState | undefined {
  if (parcel.deletedAt || parcel.status !== 'notifie') return undefined;
  const notifiedAt = firstNotification(parcel);
  const known = (dates?.get(parcel.id) ?? []).filter((at) => at > notifiedAt);
  const last = parcel.lastNotifiedAt;
  const reminders =
    last && last > notifiedAt && !known.some((at) => at >= last)
      ? [...known, last]
      : known;
  return reminderState({ notifiedAt, reminders }, now);
}

/** Where the parcel sits on the home list; nothing when it is not shown. */
export function homeState(
  parcel: LocalParcel,
  now: Date,
  dates?: ReminderDates,
): ParcelState | undefined {
  if (parcel.deletedAt) return undefined;
  switch (parcel.status) {
    case 'a_completer':
      return 'incomplete';
    case 'recu':
      return 'toNotify';
    case 'notifie':
      return reminderOf(parcel, now, dates)?.late ? 'late' : 'notified';
    case 'remis':
      return parcel.deliveredAt && parcel.deliveredAt >= startOfDay(now)
        ? 'handedOver'
        : undefined;
    case 'retourne':
      return undefined;
  }
}

const GAP_KEYS = {
  recipient: 'parcel.missing.recipient',
  tracking: 'parcel.missing.tracking',
  carrier: 'parcel.missing.carrier',
} as const satisfies Record<ParcelGap, string>;

/** What a recorded parcel lacks to be notified (F26): someone set — a card, not a name read —, a number, its carrier. */
export function gapsOf(
  parcel: Pick<
    LocalParcel,
    'type' | 'carrier' | 'tracking' | 'personId' | 'contactId'
  >,
): ParcelGap[] {
  return parcelGaps({
    type: parcel.type,
    carrier: parcel.carrier,
    tracking: parcel.tracking,
    recipient: Boolean(parcel.personId || parcel.contactId),
  });
}

/**
 * Why a parcel waits « À compléter » (F26): « Destinataire inconnu »,
 * « Numéro non lu », « Transporteur inconnu »; « Numéro à vérifier » when
 * nothing is missing but the number was never vouched for. Empty for a
 * parcel past that status.
 */
export function missingOf(
  parcel: Pick<
    LocalParcel,
    'status' | 'type' | 'carrier' | 'tracking' | 'personId' | 'contactId'
  >,
  t: TranslateFn,
  /** Gaps the screen already says otherwise: the row's title names a missing recipient. */
  shown: readonly ParcelGap[] = [],
): string {
  if (parcel.status !== 'a_completer') return '';
  const gaps = gapsOf(parcel);
  if (gaps.length === 0) {
    return parcel.type === 'sans_suivi' ? '' : t('parcel.missing.doubt');
  }
  return gaps
    .filter((gap) => !shown.includes(gap))
    .map((gap) => t(GAP_KEYS[gap]))
    .join(' · ');
}

/** "10 h 42", as the desk says it. */
export function formatTime(date: Date): string {
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "14 oct.", with the year once it is not this one. */
export function shortDate(date: Date, now: Date): string {
  return (
    date.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR
  ).format(date);
}

/** "il y a 25 min", "il y a 2 h", "hier" (the calendar day), "il y a 3 jours". */
export function formatAgo(date: Date, now: Date, t: TranslateFn): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (elapsed < MINUTE_MS) return t('parcel.ago.now');
  if (elapsed < HOUR_MS) {
    return t('parcel.ago.minutes', { count: Math.floor(elapsed / MINUTE_MS) });
  }
  const today = startOfDay(now);
  if (date >= today) {
    return t('parcel.ago.hours', { count: Math.floor(elapsed / HOUR_MS) });
  }
  if (date.getTime() >= today.getTime() - DAY_MS) {
    return t('parcel.ago.yesterday');
  }
  return t('parcel.ago.days', {
    count: Math.round((today.getTime() - startOfDay(date).getTime()) / DAY_MS),
  });
}

function statusLine(
  parcel: LocalParcel,
  state: ParcelState,
  now: Date,
  t: TranslateFn,
  dates?: ReminderDates,
): string {
  switch (state) {
    case 'incomplete':
      return missingOf(parcel, t, ['recipient']);
    case 'toNotify':
      return t('parcel.status.received', {
        time: formatTime(parcel.receivedAt),
      });
    case 'notified':
    case 'late': {
      const reminder = reminderOf(parcel, now, dates);
      const days = Math.floor(
        (now.getTime() - firstNotification(parcel).getTime()) / DAY_MS,
      );
      if (state === 'late') {
        return reminder?.sent
          ? t('parcel.status.lateReminded', { days, count: reminder.sent })
          : t('parcel.status.late', { days });
      }
      const ago = formatAgo(lastNotification(parcel), now, t);
      if (reminder?.due) return t('parcel.status.remindDue', { ago });
      return reminder?.sent
        ? t('parcel.status.reminded', { ago })
        : t('parcel.status.notified', { ago });
    }
    case 'handedOver':
      return t('parcel.status.delivered', {
        time: formatTime(parcel.deliveredAt ?? parcel.receivedAt),
      });
    case 'returned':
      return t('parcel.status.returned');
  }
}

/** The carrier as the screens name it, or why there is none. */
export function carrierLabel(
  parcel: Pick<LocalParcel, 'carrier' | 'type'>,
  t: TranslateFn,
): string {
  if (parcel.carrier) return parcel.carrier;
  return parcel.type === 'sans_suivi'
    ? t('parcel.carrier.none')
    : t('parcel.carrier.unknown');
}

/** A row of the home list, and whether a reminder is due for its parcel (F37). */
export type HomeParcel = ParcelRow & { remindDue: boolean };

/** The list row of a local parcel; nothing when the home list leaves it out. */
export function toParcelRow(
  parcel: LocalParcel,
  context: RecipientContext,
  now: Date,
  t: TranslateFn,
  dates?: ReminderDates,
): HomeParcel | undefined {
  const state = homeState(parcel, now, dates);
  if (!state) return undefined;
  return {
    ...describeParcel(parcel, state, context, now, t, dates),
    remindDue: reminderOf(parcel, now, dates)?.due ?? false,
  };
}

/** Who the parcel is for, as the rows name them. */
export function recipientOf(
  parcel: LocalParcel,
  context: RecipientContext,
): { person?: LocalDirectoryPerson; contact?: LocalContact } {
  return {
    person: parcel.personId ? context.people.get(parcel.personId) : undefined,
    contact: parcel.contactId
      ? context.contacts.get(parcel.contactId)
      : undefined,
  };
}

/** "Réserve · Carton abîmé": the parcel came damaged and the reserve stands. */
export function damageLine(
  parcel: LocalParcel,
  t: TranslateFn,
): string | undefined {
  const damage = damageOf(parcel);
  return damage
    ? t('parcel.damage', { reason: DAMAGE_LABEL[damage.reason] })
    : undefined;
}

/**
 * A contact outside the directory with no address, and none typed on the
 * parcel (« Destinataire sans e-mail »): nobody can be told by mail yet.
 */
export function addressMissing({
  parcel,
  person,
  contact,
}: {
  parcel: Pick<LocalParcel, 'status' | 'notificationEmail'>;
  person?: LocalDirectoryPerson;
  contact?: LocalContact;
}): boolean {
  return (
    (parcel.status === 'a_completer' ||
      parcel.status === 'recu' ||
      parcel.status === 'notifie') &&
    !person &&
    contact !== undefined &&
    !contact.deletedAt &&
    !contact.email &&
    !parcel.notificationEmail
  );
}

/** The list row of a parcel drawn in `state`, wherever it is listed. */
export function describeParcel(
  parcel: LocalParcel,
  state: ParcelState,
  context: RecipientContext,
  now: Date,
  t: TranslateFn,
  dates?: ReminderDates,
): ParcelRow {
  const { person, contact } = recipientOf(parcel, context);
  const recipient = person
    ? `${person.firstName} ${person.lastName}`
    : (contact?.name ?? t('parcel.recipient.unknown'));
  const department = person?.department ?? parcel.department ?? '';
  // A parcel « Sans suivi » carries the app's own number: no « ···MXA4 ».
  const last4 =
    parcel.tracking && parcel.type !== 'sans_suivi'
      ? parcel.tracking.slice(-4)
      : '';
  const carrier = carrierLabel(parcel, t);
  const pieces = parcel.pieceTotal ?? 0;
  const received = parcel.pieceN ?? pieces;
  const carrierLine =
    pieces > 1
      ? received < pieces
        ? t('parcel.pieces.partial', {
            count: received,
            total: pieces,
            carrier,
          })
        : t('parcel.pieces', { count: pieces, carrier })
      : last4
        ? `${carrier} ···${last4}`
        : carrier;
  const note =
    !person && !contact && parcel.readName
      ? t('parcel.readName', { name: parcel.readName })
      : addressMissing({ parcel, person, contact })
        ? t('contact.noEmail')
        : undefined;

  return {
    id: parcel.id,
    recipient,
    department,
    carrier,
    last4,
    state,
    status: statusLine(parcel, state, now, t, dates),
    detail: department ? `${department}, ${carrierLine}` : carrierLine,
    note,
    damage: damageLine(parcel, t),
    tracking: parcel.tracking ?? undefined,
    sender: parcel.senderName ?? undefined,
    pieces: parcel.pieceTotal ?? undefined,
    shelf: parcel.location ?? undefined,
  };
}
