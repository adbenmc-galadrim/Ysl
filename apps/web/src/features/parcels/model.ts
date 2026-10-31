import { parcelCarrierName } from '@repo/contract/mail';
import { type ParcelGap, parcelGaps } from '@repo/contract/parcel-completion';
import { DAMAGE_LABEL, damageOf } from '@repo/contract/parcel-damage';
import { standingReply } from '@repo/contract/parcel-reply';
import {
  knownReminders,
  reminderState,
  type ReminderState,
} from '@repo/contract/reminders';
import type { TranslateFn } from '@repo/shared/i18n';
import type { Parcel as ParcelRow, ParcelState } from '@repo/ui';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalHandover,
  LocalParcel,
} from '#/features/db/schema';
import { proofLabel } from '#/features/handover/delivered';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export type RecipientContext = {
  people: ReadonlyMap<string, LocalDirectoryPerson>;
  contacts: ReadonlyMap<string, LocalContact>;
  /** The standing handover of the parcels handed over, by parcel id. */
  handovers?: ReadonlyMap<string, LocalHandover>;
  /** The names of the departments, by id: a parcel on tour names where it goes. */
  departments?: ReadonlyMap<string, string>;
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
 * counts once (`lastNotifiedAt`). A recipient away (YSL-70) holds them back.
 */
export function reminderOf(
  parcel: LocalParcel,
  now: Date,
  dates?: ReminderDates,
): ReminderState | undefined {
  if (parcel.deletedAt || parcel.status !== 'notifie') return undefined;
  const notifiedAt = firstNotification(parcel);
  return reminderState(
    {
      notifiedAt,
      reminders: knownReminders(
        { notifiedAt, lastNotifiedAt: parcel.lastNotifiedAt ?? null },
        dates?.get(parcel.id) ?? [],
      ),
      pausedUntil: parcel.remindersPausedUntil ?? null,
    },
    now,
  );
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
    case 'en_route':
      return 'onTour';
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
  handover?: LocalHandover,
): string {
  switch (state) {
    case 'incomplete':
      return missingOf(parcel, t, ['recipient']);
    case 'toNotify':
    case 'onTour':
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
    case 'handedOver': {
      const time = formatTime(parcel.deliveredAt ?? parcel.receivedAt);
      if (!handover) return t('parcel.status.delivered', { time });
      const how = proofLabel(handover.method, t);
      return handover.delegateName
        ? t('parcel.status.deliveredHowDelegate', {
            time,
            how,
            delegate: handover.delegateName,
          })
        : t('parcel.status.deliveredHow', { time, how });
    }
    case 'returned':
      return t('parcel.status.returned');
  }
}

/** The carrier as the screens name it, or why there is none. */
export function carrierLabel(
  parcel: Pick<LocalParcel, 'carrier' | 'type'>,
  t: TranslateFn,
): string {
  return parcelCarrierName(parcel, t);
}

/** A row of the home list, and whether a reminder is due for its parcel (F37). */
export type HomeParcel = ParcelRow & {
  remindDue: boolean;
  /** To notify, and nobody to write to: « Prévenir » instead (YSL-72). */
  noAddress: boolean;
};

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
    noAddress:
      state === 'toNotify' &&
      addressMissing({ parcel, ...recipientOf(parcel, context) }),
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
 * A recipient with no address, a contact outside the directory or a card
 * left without one, and none typed on the parcel (« Destinataire sans
 * e-mail », YSL-72): nobody can be told by mail yet.
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
    !parcel.notificationEmail?.trim() &&
    (person
      ? !person.email.trim()
      : contact !== undefined && !contact.deletedAt && !contact.email)
  );
}

const REPLY_ROW = {
  not_mine: 'notMine',
  colleague: 'delegated',
  absent: 'absent',
} as const;

/**
 * The recipient's answer while it holds (YSL-70): « Ce n'est pas pour moi »
 * and when, the colleague who comes, the last day away.
 */
export function replyLine(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): ParcelRow['reply'] {
  const reply = standingReply(parcel, now);
  if (!reply) return undefined;
  const text =
    reply.kind === 'not_mine'
      ? t('parcel.reply.not_mine', { ago: formatAgo(reply.at, now, t) })
      : reply.kind === 'colleague'
        ? t('parcel.reply.colleague', { name: reply.delegate })
        : t('parcel.reply.absent', { date: shortDate(reply.until, now) });
  return { kind: REPLY_ROW[reply.kind], text };
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
  // A parcel in distress stays in its section, said as such: the answer
  // does not hide it (the record still names the colleague).
  const reply = state === 'late' ? undefined : replyLine(parcel, now, t);
  // « Pas pour moi » took the recipient off: the name read heads the row,
  // as the maquette names who answered.
  const recipient = person
    ? `${person.firstName} ${person.lastName}`
    : (contact?.name ??
      (reply?.kind === 'notMine' && parcel.readName
        ? parcel.readName
        : t('parcel.recipient.unknown')));
  const goesTo =
    state === 'onTour' && parcel.departmentId
      ? context.departments?.get(parcel.departmentId)
      : undefined;
  const department = goesTo ?? person?.department ?? parcel.department ?? '';
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
  const noEmail = addressMissing({ parcel, person, contact });
  const note =
    !person && !contact && parcel.readName && reply?.kind !== 'notMine'
      ? t('parcel.readName', { name: parcel.readName })
      : noEmail
        ? t('contact.noEmail')
        : undefined;

  return {
    id: parcel.id,
    recipient,
    department,
    carrier,
    last4,
    state,
    status: statusLine(
      parcel,
      state,
      now,
      t,
      dates,
      context.handovers?.get(parcel.id),
    ),
    detail: department ? `${department}, ${carrierLine}` : carrierLine,
    note,
    ...(noEmail && state === 'toNotify' ? { noteTone: 'orange' as const } : {}),
    damage: damageLine(parcel, t),
    reply,
    tracking: parcel.tracking ?? undefined,
    sender: parcel.senderName ?? undefined,
    pieces: parcel.pieceTotal ?? undefined,
    shelf: parcel.location ?? undefined,
  };
}
