import { isTrackingFlag } from '@repo/contract/imports';
import { type ParcelEvent, readParcelEvent } from '@repo/contract/parcel-event';
import {
  isStepBack,
  PARCEL_STEPS,
  type ParcelStatus,
  STATUS_TODO,
  STEP_BACK_LABEL,
  stepBackOf,
  stepOf,
} from '@repo/contract/parcel-status';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  DetailsItem,
  FicheColisScreenProps,
  HistoryEntry,
  IconName,
  TimelineStep,
} from '@repo/ui';
import type {
  LocalContact,
  LocalDirectoryPerson,
  LocalEvent,
  LocalParcel,
  OutboxOp,
} from '#/features/db/schema';
import { fullName } from '#/features/directory/people';
import { formatWeight } from '#/features/parcels/edit';
import {
  carrierLabel,
  DAY_MS,
  formatAgo,
  formatTime,
  homeState,
  shortDate,
  startOfDay,
} from '#/features/parcels/model';
import { groupTyped } from '#/features/scan/typed';

/** A parcel's record as the local database holds it. */
export type ParcelRecord = {
  parcel: LocalParcel;
  person?: LocalDirectoryPerson;
  contact?: LocalContact;
  /** The `event` rows of this parcel, from every iPhone. */
  events: readonly LocalEvent[];
  /** The outbox ops of the parcel and of its events. */
  ops: readonly OutboxOp[];
};

/** Where the parcel's own changes stand with the server. */
export type RecordSync = 'synced' | 'unsent' | 'rejected';

/** What the bottom bar offers beside "Supprimer". */
export type RecordAction =
  | { kind: 'complete' }
  | { kind: 'stepBack'; from: 'notifie' | 'retourne'; to: ParcelStatus };

export type RecordView = Pick<
  FicheColisScreenProps,
  | 'recipient'
  | 'place'
  | 'tracking'
  | 'carrier'
  | 'state'
  | 'notice'
  | 'steps'
  | 'details'
  | 'history'
> & { sync: RecordSync; action?: RecordAction };

export type DescribeOptions = {
  now: Date;
  t: TranslateFn;
  /** Offline or late: say which changes wait, as the home list does. */
  showUnsent: boolean;
};

/** "Aujourd'hui à 10 h 42", "Hier à 9 h 05", "Le 14 oct. à 12 h 05". */
export function formatWhen(date: Date, now: Date, t: TranslateFn): string {
  const time = formatTime(date);
  const today = startOfDay(now);
  if (date >= today) return t('record.when.today', { time });
  if (date.getTime() >= today.getTime() - DAY_MS) {
    return t('record.when.yesterday', { time });
  }
  return t('record.when.day', { date: shortDate(date, now), time });
}

/** As the label prints it: UPS in its 1Z groups, the others by four. */
export function formatTracking(value: string): string {
  const ups = /^1Z([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{2})(\d{4})(\d{4})$/.exec(
    value,
  );
  if (ups) return `1Z ${ups.slice(1).join(' ')}`;
  return groupTyped(value);
}

/**
 * As the Colis list tells it: from the parcel's own changes. A refused
 * event says so on its line of the history.
 */
function syncOf(ops: readonly OutboxOp[]): RecordSync {
  if (ops.some((op) => op.state === 'rejected')) return 'rejected';
  return ops.length ? 'unsent' : 'synced';
}

function stateCard(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): RecordView['state'] {
  const description = t(STATUS_TODO[parcel.status]);
  const today = startOfDay(now);
  const at = (key: 'received' | 'delivered', date: Date) =>
    date >= today
      ? t(`parcel.status.${key}`, { time: formatTime(date) })
      : t(`parcel.status.${key}On`, {
          date: shortDate(date, now),
          time: formatTime(date),
        });
  switch (parcel.status) {
    case 'a_completer':
      return {
        icon: 'alert',
        title: t('record.state.a_completer'),
        description,
      };
    case 'recu':
      return {
        icon: 'package',
        title: at('received', parcel.receivedAt),
        description,
      };
    case 'notifie': {
      const late = homeState(parcel, now) === 'late';
      const last = parcel.lastNotifiedAt ?? parcel.notifiedAt;
      return {
        icon: late ? 'clock' : 'mail',
        title: last
          ? t('parcel.status.notified', { ago: formatAgo(last, now, t) })
          : t('parcel.state.notifie'),
        description,
      };
    }
    case 'remis':
      return {
        icon: 'check',
        title: parcel.deliveredAt
          ? at('delivered', parcel.deliveredAt)
          : t('parcel.state.remis'),
        description,
      };
    case 'retourne':
      return {
        icon: 'undo',
        title: t('parcel.status.returned'),
        description,
      };
  }
}

function steps(status: ParcelStatus, t: TranslateFn): TimelineStep[] {
  const at = stepOf(status);
  if (at === undefined) return [];
  return PARCEL_STEPS.map((step, i) => ({
    label: t(`parcel.state.${step}`),
    state: i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
}

function piecesValue(parcel: LocalParcel, t: TranslateFn): string | number {
  const total = parcel.pieceTotal ?? 1;
  const received = parcel.pieceN ?? total;
  return total > 1 && received < total
    ? t('record.value.pieces', { count: received, total })
    : total;
}

function details(
  record: ParcelRecord,
  sync: RecordSync,
  { now, t }: DescribeOptions,
): DetailsItem[] {
  const { parcel, person, contact } = record;
  const email =
    parcel.notificationEmail ?? person?.email ?? contact?.email ?? null;
  const optional = (label: string, value: string | null): DetailsItem[] =>
    value ? [{ label, value }] : [];
  return [
    {
      label: t('record.detail.sender'),
      value: parcel.senderName ?? t('record.value.unknown'),
    },
    { label: t('record.detail.pieces'), value: piecesValue(parcel, t) },
    ...optional(
      t('record.detail.weight'),
      parcel.weightKg === null
        ? null
        : t('record.value.weight', { weight: formatWeight(parcel.weightKg) }),
    ),
    ...optional(t('record.detail.service'), parcel.carrierService),
    ...optional(t('record.detail.reference'), parcel.reference),
    ...optional(t('record.detail.location'), parcel.location),
    ...optional(t('record.detail.email'), email),
    {
      label: t('record.detail.note'),
      value: parcel.notes ?? t('record.value.none'),
    },
    {
      label: t('record.detail.received'),
      value: formatWhen(parcel.receivedAt, now, t),
    },
    ...optional(
      t('record.detail.delivered'),
      parcel.deliveredAt && formatWhen(parcel.deliveredAt, now, t),
    ),
    { label: t('record.detail.sync'), value: t(`record.sync.${sync}`) },
  ];
}

function eventTitle(event: ParcelEvent, t: TranslateFn): string {
  switch (event.type) {
    case 'parcel.edited':
      return t('history.edited', {
        fields: event.fields
          .map((field) => t(`history.field.${field}`))
          .join(', '),
      });
    case 'parcel.status':
      return isStepBack(event.from, event.to)
        ? t(
            `history.undo.${event.from === 'a_completer' ? 'recu' : event.from}`,
          )
        : t(`history.status.${event.to === 'a_completer' ? 'recu' : event.to}`);
    case 'parcel.deleted':
      return t('history.deleted');
    case 'parcel.imported':
      if (event.flags.some(isTrackingFlag)) {
        return t('history.imported.flagged');
      }
      if (event.flags.includes('status-unknown')) {
        return t('history.imported.status');
      }
      return event.flags.includes('recipient-missing')
        ? t('history.imported.recipient')
        : t('history.imported');
  }
}

type Dated = HistoryEntry & { at: Date };

/**
 * Newest first: the events the iPhones wrote, the reception that the row
 * itself tells, and the notification or handover a row carries without an
 * event (written before the history existed, or by the server). A change
 * still on this iPhone or refused says so.
 */
function history(
  record: ParcelRecord,
  showUnsent: boolean,
  now: Date,
  t: TranslateFn,
): HistoryEntry[] {
  const { parcel, events, ops } = record;
  const opsOf = (id: string) => ops.filter((op) => op.entityId === id);
  const entries: Dated[] = [];
  const reached = new Set<ParcelStatus>();
  for (const row of events) {
    const event = readParcelEvent(row.type, row.detail);
    if (!event) continue;
    if (event.type === 'parcel.status') reached.add(event.to);
    const own = opsOf(row.id);
    const when = formatWhen(row.at, now, t);
    const rejected = own.find((op) => op.state === 'rejected');
    entries.push({
      id: row.id,
      at: row.at,
      title: eventTitle(event, t),
      ...(rejected
        ? {
            detail: t('history.rejected', {
              reason: rejected.lastError ?? t('record.sync.rejected'),
            }),
            tone: 'red' as const,
          }
        : own.length && showUnsent
          ? { detail: t('history.pending', { when }), tone: 'orange' as const }
          : { detail: when }),
    });
  }
  const told = (status: 'notifie' | 'remis', at: Date | null) => {
    if (!at || reached.has(status)) return;
    entries.push({
      id: `row:${status}`,
      at,
      title: t(`history.status.${status}`),
      detail: formatWhen(at, now, t),
    });
  };
  told('notifie', parcel.notifiedAt);
  told('remis', parcel.deliveredAt);
  entries.push({
    id: 'row:received',
    at: parcel.receivedAt,
    title: t('history.received'),
    detail: formatWhen(parcel.receivedAt, now, t),
  });
  return entries
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map(({ id, title, detail, tone }) => ({ id, title, detail, tone }));
}

function action(parcel: LocalParcel): RecordAction | undefined {
  if (parcel.status === 'a_completer') return { kind: 'complete' };
  // Undoing a handover needs the handover cancelled with its reason (F44,
  // YSL-75). A received parcel goes back to "À compléter" from the form,
  // once it lacks a number or anyone to tell, a name read included.
  if (parcel.status !== 'notifie' && parcel.status !== 'retourne') return;
  const to = stepBackOf(parcel);
  return to && { kind: 'stepBack', from: parcel.status, to };
}

export function stepBackLabel(
  from: keyof typeof STEP_BACK_LABEL,
  t: TranslateFn,
): string {
  return t(STEP_BACK_LABEL[from]);
}

const NOTICE_ICON: Record<'unsent' | 'rejected', IconName> = {
  unsent: 'cloud',
  rejected: 'alert',
};

/** Everything the record screen shows of a parcel. */
export function describeRecord(
  record: ParcelRecord,
  options: DescribeOptions,
): RecordView {
  const { parcel, person, contact } = record;
  const { now, t, showUnsent } = options;
  const own = record.ops.filter((op) => op.entity === 'parcel');
  const sync = syncOf(own);
  const rejected = own.find((op) => op.state === 'rejected');
  const recipient = person
    ? fullName(person)
    : (contact?.name ?? t('parcel.recipient.unknown'));
  const place =
    person?.department ??
    parcel.department ??
    (!person && !contact && parcel.readName
      ? t('parcel.readName', { name: parcel.readName })
      : '');
  return {
    recipient,
    place,
    tracking: parcel.tracking
      ? formatTracking(parcel.tracking)
      : t('record.tracking.none'),
    carrier: carrierLabel(parcel, t),
    state: stateCard(parcel, now, t),
    notice:
      sync === 'rejected'
        ? {
            tone: 'red',
            icon: NOTICE_ICON.rejected,
            title: t('record.notice.rejected.title'),
            description: rejected?.lastError ?? undefined,
          }
        : sync === 'unsent' && showUnsent
          ? {
              tone: 'orange',
              icon: NOTICE_ICON.unsent,
              title: t('record.notice.unsent.title'),
              description: t('record.notice.unsent.description'),
            }
          : undefined,
    steps: steps(parcel.status, t),
    details: details(record, sync, options),
    history: history(record, showUnsent, now, t),
    sync,
    action: action(parcel),
  };
}
