import { isTrackingFlag } from '@repo/contract/imports';
import { DAMAGE_LABEL, damageOf } from '@repo/contract/parcel-damage';
import { type ParcelEvent, readParcelEvent } from '@repo/contract/parcel-event';
import { fromDayKey } from '@repo/contract/parcel-reply';
import { resumeOf } from '@repo/contract/reminders';
import { cutoff } from '@repo/contract/retention';
import { currentRetention } from '#/features/settings/company-snapshot';
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
import { awaitsNotice } from '#/features/mail/recipients';
import type {
  HandoverProofKind,
  LocalContact,
  LocalDirectoryPerson,
  LocalEvent,
  LocalHandover,
  LocalParcel,
  OutboxOp,
} from '#/features/db/schema';
import { sameName } from '#/features/handover/collector';
import { proofLabel } from '#/features/handover/delivered';
import {
  agentNameOf,
  handoverSyncOf,
  methodLabel,
} from '#/features/handover/entry';
import { firstNameOf } from '#/features/handover/recipient';
import { fullName } from '#/features/directory/people';
import { formatWeight } from '#/features/parcels/edit';
import {
  addressMissing,
  carrierLabel,
  DAY_MS,
  formatAgo,
  formatTime,
  missingOf,
  type ReminderDates,
  reminderOf,
  shortDate,
  startOfDay,
} from '#/features/parcels/model';
import { outsideDetail } from '#/features/recipient/options';
import { groupTyped } from '#/features/scan/typed';

/** A parcel's record as the local database holds it. */
export type ParcelRecord = {
  parcel: LocalParcel;
  /** The profile turned reminders off: the record calls for none. */
  remindersOff?: boolean;
  person?: LocalDirectoryPerson;
  contact?: LocalContact;
  /** On tour, the department it goes to. */
  goesTo?: string;
  /** The company runs tours, read for a parcel not on its way yet: where it goes, or that it should leave. */
  tour?: boolean;
  /** The `event` rows of this parcel, from every iPhone. */
  events: readonly LocalEvent[];
  /** The outbox ops of the parcel and of its events. */
  ops: readonly OutboxOp[];
  /** Who it was handed to and how, while it is `remis`. */
  handover?: LocalHandover;
  /** Without a standing one, the last handover of the parcel that was cancelled. */
  cancelledHandover?: LocalHandover;
  /** Handovers of this iPhone another one beat to the parcel: not its story. */
  lostHandovers?: ReadonlySet<string>;
  /** The proofs of the handover shown that this iPhone holds. */
  handoverProofs?: readonly HandoverProofKind[];
  /** The mails of its history sent through a contact (YSL-72): who, by mail id. */
  relays?: ReadonlyMap<string, string>;
};

/** Where the parcel's own changes stand with the server. */
export type RecordSync = 'synced' | 'unsent' | 'rejected';

/** What the bottom bar offers beside "Supprimer". */
export type RecordAction =
  | { kind: 'complete' }
  | { kind: 'notify' }
  /** A parcel « Reçu » in a company that runs tours (D31). */
  | { kind: 'dispatch' }
  | {
      kind: 'stepBack';
      from: 'en_route' | 'notifie' | 'retourne';
      to: ParcelStatus;
    };

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
  | 'handover'
> & { sync: RecordSync; action?: RecordAction; damage?: RecordDamage };

/**
 * The reserve the parcel carries, in words; its photos are read apart
 * (OPFS). `photos` is how many the reporting iPhone took, to say where
 * they are when this one has none.
 */
export type RecordDamage = {
  title: string;
  description: string;
  at: Date;
  photos: number;
};

export type DescribeOptions = {
  now: Date;
  t: TranslateFn;
  /** Offline or late: say which changes wait, as the home list does. */
  showUnsent: boolean;
  /** The signed-in agent: « Vous » for their handovers kept without a name. */
  me?: string;
};

export type WhenKeys = {
  today: 'record.when.today' | 'mails.when.today';
  yesterday: 'record.when.yesterday' | 'mails.when.yesterday';
  day: 'record.when.day' | 'mails.when.before';
};

const RECORD_WHEN: WhenKeys = {
  today: 'record.when.today',
  yesterday: 'record.when.yesterday',
  day: 'record.when.day',
};

/**
 * "Aujourd'hui à 10 h 42", "Hier à 9 h 05", "Le 14 oct. à 12 h 05"; other
 * `keys` word it inside a sentence ("Envoyé à 10 h 42").
 */
export function formatWhen(
  date: Date,
  now: Date,
  t: TranslateFn,
  keys: WhenKeys = RECORD_WHEN,
): string {
  const time = formatTime(date);
  const today = startOfDay(now);
  if (date >= today) return t(keys.today, { time });
  if (date.getTime() >= today.getTime() - DAY_MS) {
    return t(keys.yesterday, { time });
  }
  return t(keys.day, { date: shortDate(date, now), time });
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

/** The reminders the record's history dates: every mail sent, or word given, after the notice. */
function reminderDates(record: ParcelRecord): ReminderDates {
  const dates = record.events.flatMap((row) => {
    const type = readParcelEvent(row.type, row.detail)?.type;
    return type === 'parcel.notified' || type === 'parcel.informed'
      ? [row.at]
      : [];
  });
  return Object.assign(new Map([[record.parcel.id, dates]]), {
    remindersOff: record.remindersOff,
  });
}

function stateCard(
  record: ParcelRecord,
  now: Date,
  t: TranslateFn,
): RecordView['state'] {
  const { parcel } = record;
  const description =
    record.tour && parcel.status === 'recu'
      ? t('parcel.todo.dispatch')
      : t(STATUS_TODO[parcel.status]);
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
        description: missingOf(parcel, t, [], record.tour) || description,
      };
    case 'recu':
      return {
        icon: 'package',
        title: at('received', parcel.receivedAt),
        description,
      };
    case 'notifie': {
      const reminder = reminderOf(parcel, now, reminderDates(record));
      const first = parcel.notifiedAt;
      const when = reminder?.sent ? formatWhen(reminder.last, now, t) : '';
      const days = first
        ? Math.floor((now.getTime() - first.getTime()) / DAY_MS)
        : 0;
      return {
        icon: reminder?.late ? 'clock' : 'mail',
        title: reminder?.sent
          ? t('record.reminded', {
              when: when.charAt(0).toLowerCase() + when.slice(1),
            })
          : first
            ? t('parcel.status.notified', { ago: formatAgo(first, now, t) })
            : t('parcel.state.notifie'),
        description: reminder?.late
          ? reminder.sent
            ? t('parcel.status.lateReminded', { days, count: reminder.sent })
            : t('parcel.status.late', { days })
          : reminder?.due
            ? t('record.remindDue')
            : reminder?.sent
              ? t('record.remindedCount', { count: reminder.sent })
              : description,
      };
    }
    case 'remis':
      return {
        icon: 'check',
        title: parcel.deliveredAt
          ? at('delivered', parcel.deliveredAt)
          : t('parcel.state.remis'),
        description: record.handover
          ? t(
              record.handover.delegateName
                ? 'handover.toDelegate'
                : 'handover.to',
              {
                name: record.handover.recipientName,
                delegate: record.handover.delegateName ?? '',
                how: proofLabel(record.handover.method, t),
              },
            )
          : description,
      };
    case 'retourne':
      return {
        icon: 'undo',
        title: t('parcel.status.returned'),
        description,
      };
    case 'en_route':
    case 'depose':
      return {
        icon: 'package',
        title: t(`parcel.state.${parcel.status}`),
        description,
      };
    case 'a_regulariser':
      return {
        icon: 'alert',
        title: t('parcel.state.a_regulariser'),
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
    ...optional(
      t('record.detail.email'),
      addressMissing(record) ? t('contact.noEmail') : email,
    ),
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
    ...toldDetails(record, now, t),
    ...replyDetails(parcel, now, t),
    { label: t('record.detail.sync'), value: t(`record.sync.${sync}`) },
  ];
}

/**
 * « Prévenu via Sophie Martin », « De vive voix, hier à 15 h 10 »: how the
 * recipient without an address was last told (YSL-72), while the parcel waits.
 */
function toldDetails(
  record: ParcelRecord,
  now: Date,
  t: TranslateFn,
): DetailsItem[] {
  if (record.parcel.status !== 'notifie') return [];
  const last = record.events
    .flatMap((row) => {
      const event = readParcelEvent(row.type, row.detail);
      return event?.type === 'parcel.notified' ||
        event?.type === 'parcel.informed'
        ? [{ event, at: row.at }]
        : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  if (!last) return [];
  const label = t('record.detail.told');
  if (last.event.type === 'parcel.informed') {
    const when = formatWhen(last.at, now, t);
    return [
      {
        label,
        value: t('record.told.voice', {
          when: when.charAt(0).toLowerCase() + when.slice(1),
        }),
      },
    ];
  }
  const relay = record.relays?.get(last.event.notificationId);
  return relay ? [{ label, value: t('record.told.via', { name: relay }) }] : [];
}

/** « Retrait prévu par Paul Mercier », « Absence jusqu'au 3 nov. »: what the recipient answered, while it holds. */
function replyDetails(
  parcel: LocalParcel,
  now: Date,
  t: TranslateFn,
): DetailsItem[] {
  if (parcel.deletedAt || parcel.status !== 'notifie') return [];
  // Both may hold at once: a colleague comes while the recipient is away.
  const until = parcel.remindersPausedUntil;
  const away = until && now < resumeOf(until) ? shortDate(until, now) : null;
  return [
    ...(parcel.expectedDelegate
      ? [{ label: t('record.detail.delegate'), value: parcel.expectedDelegate }]
      : []),
    ...(away ? [{ label: t('record.detail.away'), value: away }] : []),
  ];
}

/**
 * « Remise annulée : mauvais colis »: the reason the handover kept, the first
 * when two iPhones undid it at once.
 */
function cancelledTitle(
  event: Extract<ParcelEvent, { type: 'parcel.handover_cancelled' }>,
  record: ParcelRecord,
  t: TranslateFn,
): string {
  const kept =
    record.cancelledHandover?.id === event.handoverId &&
    record.cancelledHandover.cancelReason
      ? {
          reason: record.cancelledHandover.cancelReason,
          note: record.cancelledHandover.cancelNote,
        }
      : event;
  return t(
    kept.note ? 'history.handoverCancelled.note' : 'history.handoverCancelled',
    {
      reason: t(`handover.cancel.reason.${kept.reason}`).toLowerCase(),
      note: kept.note ?? '',
    },
  );
}

/**
 * « Remis à Nora Haddad par Karim (code vérifié) »: the handover the event
 * names, when this iPhone holds it.
 */
function deliveredTitle(
  event: Extract<ParcelEvent, { type: 'parcel.delivered' }>,
  record: ParcelRecord,
  t: TranslateFn,
): string {
  const handover = [record.handover, record.cancelledHandover].find(
    (row) => row?.id === event.handoverId,
  );
  if (!handover) return t(`history.delivered.${event.method}`);
  const values = {
    name: handover.recipientName,
    delegate: handover.delegateName ?? '',
    how: proofLabel(handover.method, t),
  };
  if (handover.agentName) {
    return t(
      handover.delegateName
        ? 'history.delivered.byDelegate'
        : 'history.delivered.by',
      { ...values, agent: firstNameOf(handover.agentName) },
    );
  }
  return t(
    handover.delegateName
      ? 'history.delivered.toDelegate'
      : 'history.delivered.to',
    values,
  );
}

function eventTitle(
  event: ParcelEvent,
  record: ParcelRecord,
  now: Date,
  t: TranslateFn,
): string {
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
    case 'parcel.notified': {
      const relay = record.relays?.get(event.notificationId);
      if (relay)
        return t(
          event.kind === 'relance'
            ? 'history.reminded.via'
            : 'history.notified.via',
          { name: relay },
        );
      return t(
        event.kind === 'relance' ? 'history.reminded' : 'history.notified',
      );
    }
    case 'parcel.informed':
      return t(
        event.kind === 'relance'
          ? 'history.informed.reminder'
          : 'history.informed',
      );
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
    case 'parcel.damaged':
      return t('history.damaged', {
        reason: DAMAGE_LABEL[event.reason].toLowerCase(),
      });
    case 'parcel.damage_lifted':
      return t('history.damageLifted', {
        reason: DAMAGE_LABEL[event.reason].toLowerCase(),
      });
    case 'parcel.delivered':
      return deliveredTitle(event, record, t);
    case 'parcel.handover_cancelled':
      return cancelledTitle(event, record, t);
    case 'parcel.reply':
      return event.reply === 'colleague'
        ? t('history.reply.colleague', { name: event.delegate })
        : event.reply === 'absent'
          ? t('history.reply.absent', {
              date: shortDate(fromDayKey(event.until), now),
            })
          : t('history.reply.not_mine');
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
  const undone = new Set<string>();
  for (const row of events) {
    const event = readParcelEvent(row.type, row.detail);
    if (!event) continue;
    if (event.type === 'parcel.handover_cancelled') {
      if (undone.has(event.handoverId)) continue;
      undone.add(event.handoverId);
    }
    if (
      event.type === 'parcel.delivered' &&
      record.lostHandovers?.has(event.handoverId)
    ) {
      continue;
    }
    if (event.type === 'parcel.status') reached.add(event.to);
    if (event.type === 'parcel.notified' || event.type === 'parcel.informed')
      reached.add('notifie');
    if (event.type === 'parcel.delivered') reached.add('remis');
    const own = opsOf(row.id);
    const when = formatWhen(row.at, now, t);
    const rejected = own.find((op) => op.state === 'rejected');
    entries.push({
      id: row.id,
      at: row.at,
      title: eventTitle(event, record, now, t),
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
  // Events written in one go share their time: the last written first,
  // by their ids (UUID v7, in the order they were drawn).
  const written = (entry: Dated) => !entry.id.startsWith('row:');
  return entries
    .sort(
      (a, b) =>
        b.at.getTime() - a.at.getTime() ||
        (written(a) && written(b) ? b.id.localeCompare(a.id) : 0),
    )
    .map(({ id, title, detail, tone }) => ({ id, title, detail, tone }));
}

/**
 * The handover as the journal keeps it (F43): to whom, by whom on their
 * behalf, when, which agent, how it was proved, where it stands with the
 * server, and when it was cancelled.
 */
function handoverCard(
  record: ParcelRecord,
  { now, t, me }: DescribeOptions,
): RecordView['handover'] {
  const handover = record.handover ?? record.cancelledHandover;
  if (!handover) return undefined;
  const sync = handoverSyncOf(
    record.ops.filter(
      (op) => op.entity === 'handover' && op.entityId === handover.id,
    ),
  );
  return {
    items: handoverItems(
      handover,
      sync,
      { now, t, me },
      {
        recipient: true,
        here: record.handoverProofs,
        announced: record.parcel.expectedDelegate,
      },
    ),
  };
}

/**
 * Where a proof of the handover is: shown below, on the agent's iPhone (D8),
 * or gone once past its time (§9.2) — the flag stays on the handover, the
 * file does not, on any iPhone.
 */
function proofPlace(
  handover: LocalHandover,
  kind: HandoverProofKind,
  here: readonly HandoverProofKind[],
  { now, t }: Pick<DescribeOptions, 'now' | 't'>,
): string {
  if (here.includes(kind)) return t('record.handover.proofHere');
  const retention = currentRetention();
  const kept = kind === 'photo' ? retention.photo : retention.signature;
  return handover.at < cutoff(now, kept)
    ? t('record.handover.proofPurged')
    : t('record.handover.proofElsewhere');
}

/**
 * The rows a handover is told in, on a parcel's record and in the journal:
 * the recipient where the screen does not already name them, then who
 * collected for them, when, which agent, how, where it stands with the
 * server, and when it was cancelled where no banner says so.
 */
export function handoverItems(
  handover: LocalHandover,
  sync: RecordSync,
  { now, t, me }: Pick<DescribeOptions, 'now' | 't' | 'me'>,
  {
    recipient = false,
    cancelled = true,
    here = [],
    announced,
  }: {
    recipient?: boolean;
    cancelled?: boolean;
    /** The proofs this iPhone holds; the others stayed where they were taken. */
    here?: readonly HandoverProofKind[];
    /** The colleague the recipient announced (YSL-70), told when someone else came. */
    announced?: string | null;
  } = {},
): DetailsItem[] {
  const row = (label: string, value: string): DetailsItem[] => [
    { label, value },
  ];
  // Nobody named means nobody declared: the announcement is told alone,
  // never as if the recipient had come in person.
  const unlike =
    !!announced &&
    !sameName(announced, handover.delegateName ?? handover.recipientName);
  return [
    ...(recipient ? row(t('record.handover.to'), handover.recipientName) : []),
    ...(unlike ? row(t('record.handover.announced'), announced) : []),
    ...(handover.delegateName
      ? row(t('record.handover.delegate'), handover.delegateName)
      : []),
    ...row(t('record.handover.when'), formatWhen(handover.at, now, t)),
    ...row(t('record.handover.agent'), agentNameOf(handover, t, me)),
    ...row(t('record.handover.method'), methodLabel(handover.method, t)),
    ...(handover.hasSignature
      ? row(
          t('record.handover.signature'),
          proofPlace(handover, 'signature', here, { now, t }),
        )
      : []),
    ...(handover.hasPhoto
      ? row(
          t('record.handover.photo'),
          proofPlace(handover, 'photo', here, { now, t }),
        )
      : []),
    ...row(t('record.detail.sync'), t(`record.sync.${sync}`)),
    ...(cancelled && handover.cancelledAt
      ? row(
          t('record.handover.cancelled'),
          formatWhen(handover.cancelledAt, now, t),
        )
      : []),
    ...(handover.cancelReason
      ? row(
          t('record.handover.cancelReason'),
          t(`handover.cancel.reason.${handover.cancelReason}`),
        )
      : []),
    ...(handover.cancelNote
      ? row(t('record.handover.cancelNote'), handover.cancelNote)
      : []),
    ...(handover.cancelledByName
      ? row(t('record.handover.cancelledBy'), handover.cancelledByName)
      : []),
  ];
}

function action(parcel: LocalParcel, tour?: boolean): RecordAction | undefined {
  if (parcel.status === 'a_completer') return { kind: 'complete' };
  if (tour && parcel.status === 'recu' && !parcel.deletedAt) {
    return { kind: 'dispatch' };
  }
  if (awaitsNotice(parcel)) return { kind: 'notify' };
  // A handover is undone with its reason, by its own sheet (F44). A received
  // parcel goes back to "À compléter" from the form, once it lacks a number
  // or anyone to tell, a name read included.
  // Once its e-mail left, a tour is not undone: the recipient was told.
  if (parcel.status === 'en_route' && parcel.lastNotifiedAt) return;
  if (
    parcel.status !== 'en_route' &&
    parcel.status !== 'notifie' &&
    parcel.status !== 'retourne'
  ) {
    return;
  }
  const to = stepBackOf(parcel);
  return to && { kind: 'stepBack', from: parcel.status, to };
}

export function stepBackLabel(
  from: keyof typeof STEP_BACK_LABEL,
  t: TranslateFn,
): string {
  return t(STEP_BACK_LABEL[from]);
}

function damageCard(
  record: ParcelRecord,
  now: Date,
  t: TranslateFn,
): RecordDamage | undefined {
  const damage = damageOf(record.parcel);
  if (!damage) return undefined;
  const row = record.events.find(
    (event) =>
      event.type === 'parcel.damaged' &&
      event.at.getTime() === damage.at.getTime(),
  );
  const reported = row && readParcelEvent(row.type, row.detail);
  const when = formatWhen(damage.at, now, t);
  return {
    title: t('record.damage.title', {
      reason: DAMAGE_LABEL[damage.reason].toLowerCase(),
    }),
    description: [
      damage.note,
      damage.carrierReserve ? t('record.damage.carrier') : null,
      t('record.damage.when', {
        when: when.charAt(0).toLowerCase() + when.slice(1),
      }),
    ]
      .filter(Boolean)
      .join(' · '),
    at: damage.at,
    photos: reported?.type === 'parcel.damaged' ? reported.photos : 0,
  };
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
  const place = record.goesTo
    ? record.goesTo
    : person
      ? (person.department ?? parcel.department ?? '')
      : contact
        ? outsideDetail({
            department: parcel.department ?? contact.department ?? null,
          })
        : (parcel.department ??
          (parcel.readName
            ? t('parcel.readName', { name: parcel.readName })
            : ''));
  return {
    recipient,
    place,
    tracking: parcel.tracking
      ? formatTracking(parcel.tracking)
      : t('record.tracking.none'),
    carrier: carrierLabel(parcel, t),
    state: stateCard(record, now, t),
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
    action: action(parcel, record.tour),
    damage: damageCard(record, now, t),
    handover: handoverCard(record, options),
  };
}
