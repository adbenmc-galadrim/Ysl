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
 * reminder at J+2). Counted from the first notification: a reminder does not
 * make the wait shorter. A mailroom setting may replace this constant later.
 */
export const LATE_AFTER_MS = 2 * DAY_MS;

/** The statuses the home list follows until the parcel leaves the desk. */
export const HOME_OPEN_STATUSES = [
  'a_completer',
  'recu',
  'notifie',
] as const satisfies readonly LocalParcel['status'][];

export type RecipientContext = {
  people: ReadonlyMap<string, LocalDirectoryPerson>;
  contacts: ReadonlyMap<string, LocalContact>;
};

export function startOfDay(now: Date): Date {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
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
    case 'notifie': {
      const since = parcel.notifiedAt ?? parcel.receivedAt;
      return now.getTime() - since.getTime() >= LATE_AFTER_MS
        ? 'late'
        : 'notified';
    }
    case 'remis':
      return parcel.deliveredAt && parcel.deliveredAt >= startOfDay(now)
        ? 'handedOver'
        : undefined;
    case 'retourne':
      return undefined;
  }
}

/** "10 h 42", as the desk says it. */
export function formatTime(date: Date): string {
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "il y a 25 min", "il y a 2 h", "hier", "il y a 3 jours". */
export function formatAgo(date: Date, now: Date, t: TranslateFn): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (elapsed < MINUTE_MS) return t('parcel.ago.now');
  if (elapsed < HOUR_MS) {
    return t('parcel.ago.minutes', { count: Math.floor(elapsed / MINUTE_MS) });
  }
  if (elapsed < DAY_MS) {
    return t('parcel.ago.hours', { count: Math.floor(elapsed / HOUR_MS) });
  }
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1
    ? t('parcel.ago.yesterday')
    : t('parcel.ago.days', { count: days });
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
        ago: formatAgo(parcel.notifiedAt ?? parcel.receivedAt, now, t),
      });
    case 'late': {
      const since = parcel.notifiedAt ?? parcel.receivedAt;
      const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
      const reminded =
        parcel.lastNotifiedAt && parcel.lastNotifiedAt > since
          ? parcel.lastNotifiedAt
          : undefined;
      return reminded
        ? t('parcel.status.lateReminded', {
            days,
            ago: formatAgo(reminded, now, t),
          })
        : t('parcel.status.late', { days });
    }
    case 'handedOver':
      return t('parcel.status.delivered', {
        time: formatTime(parcel.deliveredAt ?? parcel.receivedAt),
      });
  }
}

function carrierLabel(parcel: LocalParcel, t: TranslateFn): string {
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
  if (!state) return undefined;

  const person = parcel.personId
    ? context.people.get(parcel.personId)
    : undefined;
  const contact = parcel.contactId
    ? context.contacts.get(parcel.contactId)
    : undefined;
  const recipient = person
    ? `${person.firstName} ${person.lastName}`
    : (contact?.name ?? t('parcel.recipient.unknown'));
  const department = person?.department ?? parcel.department ?? '';
  const last4 = parcel.tracking ? parcel.tracking.slice(-4) : '';
  const carrier = carrierLabel(parcel, t);
  const carrierLine = last4 ? `${carrier} ···${last4}` : carrier;
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
    tracking: parcel.tracking ?? undefined,
    sender: parcel.senderName ?? undefined,
    pieces: parcel.pieceTotal ?? undefined,
    shelf: parcel.location ?? undefined,
  };
}
