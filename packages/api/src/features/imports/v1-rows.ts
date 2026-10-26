import {
  type ImportFlag,
  type ImportSkip,
  isTrackingFlag,
} from '@repo/contract/imports';
import type { ParcelStatus } from '@repo/contract/parcel-status';
import {
  normalizeTracking,
  type TrackingContext,
  trackingContexts,
  validateTracking,
} from '@repo/contract/tracking';
import { readCsvRecords } from '@repo/shared/csv-read';
import type { TranslateFn } from '@repo/shared/i18n';

/** The columns of the v1 export (§3.2 of the v1 review); only two are required. */
export const V1_COLUMNS = [
  'id',
  'date_reception',
  'date_remise',
  'statut',
  'transporteur',
  'tracking',
  'destinataire',
  'email',
  'departement',
  'expediteur',
  'nb_colis',
  'notes',
] as const;

type V1Column = (typeof V1_COLUMNS)[number];

const REQUIRED: readonly V1Column[] = ['tracking', 'destinataire'];

/**
 * The v1 statuses and the v2 status each one becomes. "En attente" could
 * only come from an import in the v1, a dead status: it is something to
 * look at again, so À compléter. "Retourne" is what the v2 export writes.
 */
const STATUSES: Record<string, ParcelStatus> = {
  recu: 'recu',
  notifie: 'notifie',
  remis: 'remis',
  'en attente': 'a_completer',
  retourne: 'retourne',
};

const OPEN: readonly ParcelStatus[] = ['a_completer', 'recu', 'notifie'];

const CARRIER_ALIASES: Record<string, TrackingContext> = {
  dhl: 'dhl-express',
  laposte: 'la-poste',
  autre: 'other',
};

export type V1Row = {
  line: number;
  /** The `id` cell of the v1, kept to tell two rows apart for good. */
  sourceId: string;
  tracking: string;
  trackingNorm: string;
  carrier: string | null;
  recipient: string | null;
  email: string | null;
  department: string | null;
  sender: string | null;
  pieces: number | null;
  notes: string | null;
  receivedAt: Date;
  deliveredAt: Date | null;
  status: ParcelStatus;
  flags: ImportFlag[];
  /** The v1 status as written, when it was not one the v1 knew. */
  unknownStatus?: string;
};

export type V1Skip = {
  line: number;
  tracking: string;
  recipient: string | null;
  reason: ImportSkip;
};

export type V1File =
  { ok: true; rows: V1Row[]; skips: V1Skip[] } | { ok: false };

/** The formula guard of the v1 and v2 exports: a quote before `=+-@`, tab or CR. */
export function unguard(cell: string): string {
  return cell.replace(/^'(?=[=+\-@\t\r])/, '');
}

const key = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** The v2 status of a v1 one, accents and case aside; undefined when unknown. */
export function v1Status(text: string): ParcelStatus | undefined {
  return STATUSES[key(text)];
}

/** The carrier context a v1 carrier names (`DHL` is DHL Express). */
export function v1Carrier(
  text: string,
  t: TranslateFn,
): TrackingContext | undefined {
  const compact = key(text).replace(/[^a-z0-9]/g, '');
  if (!compact) return undefined;
  return (
    CARRIER_ALIASES[compact] ??
    trackingContexts.find(
      (context) =>
        key(t(`carrier.${context}`)).replace(/[^a-z0-9]/g, '') === compact ||
        context.replace(/-/g, '') === compact,
    )
  );
}

const offsetInParis = (utc: number) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utc));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return local - utc;
};

const FRENCH_DATE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2})[:h](\d{2})(?::(\d{2}))?)?$/;

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}[ T][\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/i;

const ISO_LOCAL =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/** A wall-clock time in Paris, checked field by field (no 31/02, no 14:75). */
function parisTime(
  parts: readonly (string | undefined)[],
  order: 'dmy' | 'ymd',
): Date | null {
  const numbers = parts.map((part) => Number(part ?? 0));
  const [day, month, year] =
    order === 'dmy'
      ? [numbers[0]!, numbers[1]!, numbers[2]!]
      : [numbers[2]!, numbers[1]!, numbers[0]!];
  const [hour, minute, second] = [numbers[3]!, numbers[4]!, numbers[5]!];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (new Date(wall).getUTCDate() !== day) return null;
  const first = wall - offsetInParis(wall);
  return new Date(wall - offsetInParis(first));
}

/**
 * A date of the file: ISO with its zone as the v1 wrote it, ISO without a
 * zone or `JJ/MM/AAAA HH:MM` in Paris time, as the v2 export writes it and
 * Excel saves it back.
 */
export function v1Date(text: string): Date | null {
  const value = text.trim();
  if (ISO_WITH_ZONE.test(value)) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : new Date(time);
  }
  const iso = ISO_LOCAL.exec(value);
  if (iso) return parisTime(iso.slice(1), 'ymd');
  const french = FRENCH_DATE.exec(value);
  return french ? parisTime(french.slice(1), 'dmy') : null;
}

const orNull = (text: string) => text || null;

/**
 * The rows of a v1 export, each tracking checked again by its carrier's key
 * (F52): what is unsure is kept but marked, never taken as sure. Rows
 * without a tracking or a readable reception date are left out, as in the
 * v1, and so is a row already met higher in the file.
 */
export function readV1File(text: string, t: TranslateFn): V1File {
  const [header, ...records] = readCsvRecords(text);
  if (!header) return { ok: false };
  const names = header.cells.map((name) => key(unguard(name)));
  const index = Object.fromEntries(
    V1_COLUMNS.map((column) => [column, names.indexOf(column)]),
  ) as Record<V1Column, number>;
  if (REQUIRED.some((column) => index[column] < 0)) return { ok: false };

  const rows: V1Row[] = [];
  const skips: V1Skip[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  records.forEach(({ line, cells }) => {
    const cell = (column: V1Column) => {
      const at = index[column];
      return at < 0 ? '' : unguard(cells[at] ?? '').trim();
    };
    const tracking = cell('tracking');
    const recipient = orNull(cell('destinataire'));
    const skip = (reason: ImportSkip) =>
      skips.push({ line, tracking, recipient, reason });

    const trackingNorm = normalizeTracking(tracking);
    if (!trackingNorm) return skip('tracking-missing');
    const receivedAt = v1Date(cell('date_reception'));
    if (!receivedAt) return skip('date-invalid');

    const sourceId = cell('id');
    const sameParcel = sameParcelKey(trackingNorm, receivedAt);
    if ((sourceId && seenIds.has(sourceId)) || seenKeys.has(sameParcel)) {
      return skip('duplicate-in-file');
    }
    if (sourceId) seenIds.add(sourceId);
    seenKeys.add(sameParcel);

    const flags: ImportFlag[] = [];
    const written = cell('transporteur');
    const context = v1Carrier(written, t);
    const verdict = validateTracking(
      tracking,
      context && context !== 'other' ? { context } : {},
    );
    if (verdict.status === 'rejected') flags.push('tracking-rejected');
    if (verdict.status === 'to-verify') flags.push('tracking-to-verify');
    const named =
      context ?? (verdict.status === 'sure' ? verdict.carrier : null);
    const carrier = named ? t(`carrier.${named}`) : orNull(written);

    const statusText = cell('statut');
    let status = statusText ? v1Status(statusText) : 'recu';
    let unknownStatus: string | undefined;
    if (!status) {
      flags.push('status-unknown');
      unknownStatus = statusText;
      status = 'a_completer';
    }
    const email = orNull(cell('email'));
    if (!recipient && !email) {
      flags.push('recipient-missing');
      if (status !== 'retourne') status = 'a_completer';
    }
    if (flags.some(isTrackingFlag) && OPEN.includes(status)) {
      status = 'a_completer';
    }

    const count = Number.parseInt(cell('nb_colis'), 10);
    rows.push({
      line,
      sourceId,
      tracking,
      trackingNorm,
      carrier,
      recipient,
      email,
      department: orNull(cell('departement')),
      sender: orNull(cell('expediteur')),
      pieces: count > 1 ? Math.min(count, 999) : null,
      notes: orNull(cell('notes')),
      receivedAt,
      deliveredAt:
        status === 'remis' ? (v1Date(cell('date_remise')) ?? receivedAt) : null,
      status,
      flags,
      ...(unknownStatus === undefined ? {} : { unknownStatus }),
    });
  });

  return { ok: true, rows, skips };
}

/** Same tracking received the same minute: the same parcel, wherever it came from. */
export function sameParcelKey(trackingNorm: string, receivedAt: Date): string {
  return `${trackingNorm}|${Math.floor(receivedAt.getTime() / 60_000)}`;
}
