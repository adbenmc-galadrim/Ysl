import { type ParcelGap, parcelGaps } from '@repo/contract/parcel-completion';
import { DAMAGE_LABEL, damageOf } from '@repo/contract/parcel-damage';
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

/**
 * A notified parcel nobody came for in two days needs chasing (D12: first
 * reminder at J+2). Counted from the last notification, as the server's
 * overdue index does. A mailroom setting may replace this constant later.
 */
export const LATE_AFTER_MS = 2 * DAY_MS;

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

/** Where the parcel sits on the home list; nothing when it is not shown. */
export function homeState(
  parcel: LocalParcel,
  now: Date,
): ParcelState | undefined {
  if (parcel.deletedAt) return undefined;
  switch (parcel.status) {
    case 'a_completer':
      return 'incomplete';
    case 'recu':
      return 'toNotify';
    case 'notifie':
      return now.getTime() - lastNotification(parcel).getTime() >= LATE_AFTER_MS
        ? 'late'
        : 'notified';
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
): string {
  if (parcel.status !== 'a_completer') return '';
  const gaps = parcelGaps({
    type: parcel.type,
    carrier: parcel.carrier,
    tracking: parcel.tracking,
    recipient: Boolean(parcel.personId || parcel.contactId),
  });
  if (gaps.length === 0) {
    return parcel.type === 'sans_suivi' ? '' : t('parcel.missing.doubt');
  }
  return gaps.map((gap) => t(GAP_KEYS[gap])).join(' · ');
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
): string {
  switch (state) {
    case 'incomplete':
      return '';
    case 'toNotify':
      return t('parcel.status.received', {
        time: formatTime(parcel.receivedAt),
      });
    case 'notified':
      return t('parcel.status.notified', {
        ago: formatAgo(lastNotification(parcel), now, t),
      });
    case 'late': {
      const first = firstNotification(parcel);
      const last = lastNotification(parcel);
      const days = Math.floor((now.getTime() - first.getTime()) / DAY_MS);
      return last > first
        ? t('parcel.status.lateReminded', {
            days,
            ago: formatAgo(last, now, t),
          })
        : t('parcel.status.late', { days });
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

/** The list row of a local parcel; nothing when the home list leaves it out. */
export function toParcelRow(
  parcel: LocalParcel,
  context: RecipientContext,
  now: Date,
  t: TranslateFn,
): ParcelRow | undefined {
  const state = homeState(parcel, now);
  return state && describeParcel(parcel, state, context, now, t);
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

/** The list row of a parcel drawn in `state`, wherever it is listed. */
export function describeParcel(
  parcel: LocalParcel,
  state: ParcelState,
  context: RecipientContext,
  now: Date,
  t: TranslateFn,
): ParcelRow {
  const { person, contact } = recipientOf(parcel, context);
  const recipient = person
    ? `${person.firstName} ${person.lastName}`
    : (contact?.name ?? t('parcel.recipient.unknown'));
  const department = person?.department ?? parcel.department ?? '';
  const last4 = parcel.tracking ? parcel.tracking.slice(-4) : '';
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
      : undefined;

  return {
    id: parcel.id,
    recipient,
    department,
    carrier,
    last4,
    state,
    status: statusLine(parcel, state, now, t),
    detail: department ? `${department}, ${carrierLine}` : carrierLine,
    note,
    damage: damageLine(parcel, t),
    tracking: parcel.tracking ?? undefined,
    sender: parcel.senderName ?? undefined,
    pieces: parcel.pieceTotal ?? undefined,
    shelf: parcel.location ?? undefined,
  };
}
