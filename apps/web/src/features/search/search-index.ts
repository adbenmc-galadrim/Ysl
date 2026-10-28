import type { TranslateFn } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import type { ColisSection, Parcel as ParcelRow, ParcelState } from '@repo/ui';
import type { LocalParcel } from '#/features/db/schema';
import {
  DAY_MS,
  describeParcel,
  formatTime,
  homeState,
  type RecipientContext,
  recipientOf,
  type ReminderDates,
  shortDate,
  startOfDay,
} from '#/features/parcels/model';

export const SEARCH_FILTERS = [
  'all',
  'waiting',
  'delivered',
  'last30',
  'today',
  'incomplete',
  'late',
] as const;

export type SearchFilter = (typeof SEARCH_FILTERS)[number];

export const SEARCH_GROUPINGS = ['status', 'recipient', 'date'] as const;

export type SearchGrouping = (typeof SEARCH_GROUPINGS)[number];

/**
 * One parcel as the search reads it: its row, drawn once, and its fields
 * normalized once, so a keystroke only compares strings.
 */
export type SearchEntry = {
  row: ParcelRow;
  /** The day it came in, or went out once handed over. */
  at: Date;
  recipient: { key: string; name: string; sortKey: string };
  /** Name, label name, service, carrier, sender: normalized words. */
  text: string;
  /** The tracking number, normalized and without spaces. */
  tracking: string;
};

/** Where the parcel stands in the search, which keeps every parcel. */
export function searchState(
  parcel: LocalParcel,
  now: Date,
  dates?: ReminderDates,
): ParcelState | undefined {
  if (parcel.deletedAt) return undefined;
  if (parcel.status === 'remis') return 'handedOver';
  if (parcel.status === 'retourne') return 'returned';
  return homeState(parcel, now, dates);
}

/**
 * The home list only shows today's handovers and recent receptions, so it
 * says "à 10 h 42"; the search reaches back months and names the day.
 */
function datedStatus(
  parcel: LocalParcel,
  state: ParcelState,
  now: Date,
  t: TranslateFn,
): string | undefined {
  const today = startOfDay(now);
  if (state === 'handedOver' && parcel.deliveredAt) {
    return parcel.deliveredAt >= today
      ? t('parcel.status.delivered', { time: formatTime(parcel.deliveredAt) })
      : t('parcel.status.deliveredOn', {
          date: shortDate(parcel.deliveredAt, now),
          time: formatTime(parcel.deliveredAt),
        });
  }
  if (state === 'toNotify' && parcel.receivedAt < today) {
    return t('parcel.status.receivedOn', {
      date: shortDate(parcel.receivedAt, now),
      time: formatTime(parcel.receivedAt),
    });
  }
  return undefined;
}

/** Sorts after any normalized name: the unknown recipients close the list. */
const UNKNOWN_LAST = '\uffff';

export function toSearchEntry(
  parcel: LocalParcel,
  context: RecipientContext,
  now: Date,
  t: TranslateFn,
  dates?: ReminderDates,
): SearchEntry | undefined {
  const state = searchState(parcel, now, dates);
  if (!state) return undefined;
  const described = describeParcel(parcel, state, context, now, t, dates);
  const status = datedStatus(parcel, state, now, t);
  const row = status ? { ...described, status } : described;
  const { person, contact } = recipientOf(parcel, context);
  const key = person
    ? `person:${person.id}`
    : contact
      ? `contact:${contact.id}`
      : 'unknown';
  return {
    row,
    at:
      parcel.status === 'remis' && parcel.deliveredAt
        ? parcel.deliveredAt
        : parcel.receivedAt,
    recipient: {
      key,
      name: row.recipient,
      sortKey: key === 'unknown' ? UNKNOWN_LAST : normalizeName(row.recipient),
    },
    text: normalizeName(
      [
        row.recipient,
        parcel.readName,
        row.department,
        row.carrier,
        parcel.carrierService,
        parcel.senderName,
      ]
        .filter(Boolean)
        .join(' '),
    ),
    tracking: normalizeName(parcel.tracking ?? '').replaceAll(' ', ''),
  };
}

export type SearchQuery = { words: string[]; compact: string };

export function prepareQuery(query: string): SearchQuery {
  const words = normalizeName(query).split(' ').filter(Boolean);
  return { words, compact: words.join('') };
}

/** Every word somewhere in the fields, or the whole query in the tracking. */
export function matchesQuery(entry: SearchEntry, query: SearchQuery): boolean {
  if (!query.words.length) return true;
  if (entry.tracking.includes(query.compact)) return true;
  return query.words.every((word) => entry.text.includes(word));
}

const WAITING: readonly ParcelState[] = [
  'incomplete',
  'toNotify',
  'notified',
  'late',
];

export function matchesFilter(
  entry: SearchEntry,
  filter: SearchFilter,
  now: Date,
): boolean {
  const { state } = entry.row;
  switch (filter) {
    case 'all':
      return true;
    case 'waiting':
      return WAITING.includes(state);
    case 'delivered':
      return state === 'handedOver';
    case 'last30':
      return entry.at.getTime() >= now.getTime() - 30 * DAY_MS;
    case 'today':
      return entry.at >= startOfDay(now);
    case 'incomplete':
      return state === 'incomplete';
    case 'late':
      return state === 'late';
  }
}

/** The entries kept by the query and the chip, in the order they came. */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  filter: SearchFilter,
  now: Date,
): SearchEntry[] {
  const prepared = prepareQuery(query);
  return entries.filter(
    (entry) =>
      matchesFilter(entry, filter, now) && matchesQuery(entry, prepared),
  );
}

/** Latest first: the last parcel in or out is the one asked about. */
export function byLatest(a: SearchEntry, b: SearchEntry): number {
  return b.at.getTime() - a.at.getTime();
}

const STATUS_GROUPS = [
  {
    id: 'incomplete',
    key: 'search.section.incomplete',
    states: ['incomplete'],
  },
  { id: 'toNotify', key: 'search.section.toNotify', states: ['toNotify'] },
  {
    id: 'waiting',
    key: 'search.section.waiting',
    states: ['notified', 'late'],
  },
  {
    id: 'handedOver',
    key: 'search.section.handedOver',
    states: ['handedOver'],
  },
  { id: 'returned', key: 'search.section.returned', states: ['returned'] },
] as const satisfies readonly {
  id: string;
  key: string;
  states: readonly ParcelState[];
}[];

const DAY_TITLE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const DAY_TITLE_YEAR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "Aujourd’hui", "Hier", "Mercredi 14 octobre", "Lundi 3 novembre 2025". */
export function dayTitle(day: Date, now: Date, t: TranslateFn): string {
  const today = startOfDay(now);
  if (day.getTime() === today.getTime()) return t('search.day.today');
  // Half a day back lands in yesterday even on a 23 or 25 hour day.
  const yesterday = startOfDay(new Date(today.getTime() - DAY_MS / 2));
  if (day.getTime() === yesterday.getTime()) return t('search.day.yesterday');
  const title = (
    day.getFullYear() === now.getFullYear() ? DAY_TITLE : DAY_TITLE_YEAR
  ).format(day);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Groups of rows already sorted latest first; the groups keep that order. */
function groupBy(
  entries: readonly SearchEntry[],
  keyOf: (entry: SearchEntry) => string,
): Map<string, SearchEntry[]> {
  const groups = new Map<string, SearchEntry[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

const rows = (entries: readonly SearchEntry[]) =>
  entries.map((entry) => entry.row);

/**
 * The results in sections: by where the parcels stand (the mockup), by
 * recipient in alphabetical order, or by day, latest first.
 */
export function groupResults(
  results: readonly SearchEntry[],
  grouping: SearchGrouping,
  now: Date,
  t: TranslateFn,
): ColisSection[] {
  const sorted = [...results].sort(byLatest);
  switch (grouping) {
    case 'status':
      return STATUS_GROUPS.flatMap(({ id, key, states }) => {
        const parcels = sorted.filter((entry) =>
          (states as readonly ParcelState[]).includes(entry.row.state),
        );
        return parcels.length
          ? [{ id, title: t(key), parcels: rows(parcels) }]
          : [];
      });
    case 'recipient': {
      const groups = groupBy(sorted, (entry) => entry.recipient.key);
      return [...groups.entries()]
        .sort(([, [a]], [, [b]]) =>
          a!.recipient.sortKey.localeCompare(b!.recipient.sortKey, 'fr'),
        )
        .map(([key, entries]) => ({
          id: key,
          title: entries[0]!.recipient.name,
          parcels: rows(entries),
        }));
    }
    case 'date': {
      const groups = groupBy(sorted, (entry) =>
        String(startOfDay(entry.at).getTime()),
      );
      return [...groups.entries()].map(([key, entries]) => ({
        id: key,
        title: dayTitle(new Date(Number(key)), now, t),
        parcels: rows(entries),
      }));
    }
  }
}
