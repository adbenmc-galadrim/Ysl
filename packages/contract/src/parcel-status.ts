import type { TranslationKey } from '@repo/shared/i18n';

export const PARCEL_STATUSES = [
  'a_completer',
  'recu',
  'en_route',
  'depose',
  'a_regulariser',
  'notifie',
  'remis',
  'retourne',
] as const;

export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** The arrows of §8.3: what the mailroom does next. */
export const FORWARD_TRANSITIONS: Record<
  ParcelStatus,
  readonly ParcelStatus[]
> = {
  a_completer: ['recu'],
  recu: ['en_route', 'notifie', 'remis', 'retourne'],
  en_route: ['depose', 'a_regulariser', 'notifie'],
  depose: ['a_regulariser', 'notifie', 'remis', 'retourne'],
  a_regulariser: ['en_route', 'retourne'],
  notifie: ['a_regulariser', 'remis', 'retourne'],
  remis: [],
  retourne: [],
};

/**
 * F30: every step forward can be undone, back to where it came from. Leaving
 * `remis` still needs a cancelled handover (the trigger of @repo/db).
 */
export const BACKWARD_TRANSITIONS: Record<
  ParcelStatus,
  readonly ParcelStatus[]
> = {
  a_completer: [],
  recu: ['a_completer'],
  en_route: ['recu', 'a_regulariser'],
  depose: ['en_route'],
  a_regulariser: ['en_route', 'depose', 'notifie'],
  notifie: ['recu', 'en_route', 'depose'],
  remis: ['notifie', 'depose', 'recu'],
  retourne: ['notifie', 'depose', 'a_regulariser', 'recu'],
};

/** Staying put is always allowed. */
export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return (
    from === to ||
    FORWARD_TRANSITIONS[from].includes(to) ||
    BACKWARD_TRANSITIONS[from].includes(to)
  );
}

/** A gap and its reassignment go both ways: each is a step forward first. */
export function isStepBack(from: ParcelStatus, to: ParcelStatus): boolean {
  return (
    BACKWARD_TRANSITIONS[from].includes(to) &&
    !FORWARD_TRANSITIONS[from].includes(to)
  );
}

/** The statuses the home list follows until the parcel leaves the desk. */
export const OPEN_STATUSES = [
  'a_completer',
  'recu',
  'en_route',
  'depose',
  'a_regulariser',
  'notifie',
] as const satisfies readonly ParcelStatus[];

/** Statuses of the tour (§3.7.6): a PWA of before knows none of them, `sync.pull` holds them back. */
export const TOUR_STATUSES = [
  'en_route',
  'depose',
  'a_regulariser',
] as const satisfies readonly ParcelStatus[];

/** Everything not yet out of the company's hands: a department holding one stays open. */
export const UNFINISHED_STATUSES = OPEN_STATUSES;

/** The progress line of the parcel sheet: Reçu, Notifié, Remis. */
export const PARCEL_STEPS = [
  'recu',
  'notifie',
  'remis',
] as const satisfies readonly ParcelStatus[];

/** Where the parcel stands on the progress line; nothing once returned. */
export function stepOf(status: ParcelStatus): number | undefined {
  if (status === 'a_completer') return 0;
  const step = PARCEL_STEPS.indexOf(status as (typeof PARCEL_STEPS)[number]);
  return step < 0 ? undefined : step;
}

export const STATUS_LABEL = {
  a_completer: 'parcel.state.a_completer',
  recu: 'parcel.state.recu',
  en_route: 'parcel.state.en_route',
  depose: 'parcel.state.depose',
  a_regulariser: 'parcel.state.a_regulariser',
  notifie: 'parcel.state.notifie',
  remis: 'parcel.state.remis',
  retourne: 'parcel.state.retourne',
} as const satisfies Record<ParcelStatus, TranslationKey>;

/** §8.3: what is left to do, said by the status itself. */
export const STATUS_TODO = {
  a_completer: 'parcel.todo.a_completer',
  recu: 'parcel.todo.recu',
  en_route: 'parcel.todo.en_route',
  depose: 'parcel.todo.depose',
  a_regulariser: 'parcel.todo.a_regulariser',
  notifie: 'parcel.todo.notifie',
  remis: 'parcel.todo.remis',
  retourne: 'parcel.todo.retourne',
} as const satisfies Record<ParcelStatus, TranslationKey>;

/** The undo action of a status, named after the step it takes back. */
export const STEP_BACK_LABEL = {
  recu: 'parcel.undo.recu',
  en_route: 'parcel.undo.en_route',
  notifie: 'parcel.undo.notifie',
  remis: 'parcel.undo.remis',
  retourne: 'parcel.undo.retourne',
} as const satisfies Partial<Record<ParcelStatus, TranslationKey>>;

/** The status columns a change of status writes. */
export type StatusFields = {
  status: ParcelStatus;
  /** Missing on a row pulled before the counter existed: read as 0. */
  statusSeq?: number | null;
  notifiedAt: Date | null;
  lastNotifiedAt: Date | null;
  deliveredAt: Date | null;
  deliveredBy: string | null;
  /** Missing on a row pulled before the column existed: read as not deposited. */
  depositedAt?: Date | null;
  departmentId?: string | null;
};

/** Where undoing the last step leads: a parcel never notified goes back to its deposit, else to `recu`; one whose e-mail left on tour goes back on tour. */
export function stepBackOf(
  parcel: Pick<StatusFields, 'status' | 'notifiedAt'> &
    Partial<Pick<StatusFields, 'lastNotifiedAt' | 'depositedAt'>>,
): ParcelStatus | undefined {
  switch (parcel.status) {
    case 'a_completer':
      return undefined;
    case 'recu':
      return 'a_completer';
    case 'en_route':
      return 'recu';
    case 'depose':
      return 'en_route';
    case 'a_regulariser':
      return parcel.notifiedAt
        ? 'notifie'
        : parcel.depositedAt
          ? 'depose'
          : 'en_route';
    case 'notifie':
      if (!parcel.depositedAt) return 'recu';
      return parcel.notifiedAt &&
        parcel.lastNotifiedAt &&
        parcel.lastNotifiedAt < parcel.notifiedAt
        ? 'en_route'
        : 'depose';
    case 'remis':
    case 'retourne':
      return parcel.notifiedAt
        ? 'notifie'
        : parcel.depositedAt
          ? 'depose'
          : 'recu';
  }
}

export class StatusTransitionError extends Error {
  constructor(
    readonly from: ParcelStatus,
    readonly to: ParcelStatus,
  ) {
    super(`A parcel cannot go from ${from} to ${to}`);
    this.name = 'StatusTransitionError';
  }
}

export type StatusWrite = Omit<
  StatusFields,
  'statusSeq' | 'depositedAt' | 'departmentId'
> & {
  statusSeq: number;
  depositedAt: Date | null;
};

export type StatusChangeContext = { now: Date; agentId: string };

/**
 * The notice of a parcel on its next status. On tour, `lastNotifiedAt` alone
 * says an e-mail left (§3.7.9): it stays through the tour, so none leaves twice,
 * and earlier than `notifiedAt` it counts as no reminder: they run from the deposit.
 */
function noticeAfter(
  parcel: StatusFields,
  to: ParcelStatus,
  now: Date,
): Pick<StatusFields, 'notifiedAt' | 'lastNotifiedAt'> {
  switch (to) {
    case 'a_completer':
    case 'recu':
    case 'depose':
      return { notifiedAt: null, lastNotifiedAt: null };
    case 'en_route':
      return {
        notifiedAt: null,
        lastNotifiedAt: parcel.lastNotifiedAt ?? parcel.notifiedAt,
      };
    case 'notifie':
      return {
        notifiedAt: parcel.notifiedAt ?? now,
        lastNotifiedAt: parcel.lastNotifiedAt,
      };
    default:
      return {
        notifiedAt: parcel.notifiedAt,
        lastNotifiedAt: parcel.lastNotifiedAt,
      };
  }
}

function depositAfter(
  parcel: StatusFields,
  to: ParcelStatus,
  now: Date,
): Date | null {
  if (to === 'a_completer' || to === 'recu' || to === 'en_route') return null;
  const deposited =
    to === 'depose' || (to === 'notifie' && parcel.status === 'en_route');
  return parcel.depositedAt ?? (deposited ? now : null);
}

/**
 * The columns to write for a change of status. `statusSeq` moves one up: the
 * server takes a step back only with it, so a stale copy cannot pass for an
 * undo (parcel_status_stale).
 */
export function statusPatch(
  parcel: StatusFields,
  to: ParcelStatus,
  { now, agentId }: StatusChangeContext,
): StatusWrite {
  if (parcel.status === to || !canTransition(parcel.status, to)) {
    throw new StatusTransitionError(parcel.status, to);
  }
  if (to === 'en_route' && !parcel.departmentId) {
    throw new StatusTransitionError(parcel.status, to);
  }
  return {
    status: to,
    statusSeq: (parcel.statusSeq ?? 0) + 1,
    ...noticeAfter(parcel, to, now),
    deliveredAt: to === 'remis' ? now : null,
    deliveredBy: to === 'remis' ? agentId : null,
    depositedAt: depositAfter(parcel, to, now),
  };
}

/**
 * Where a confirmed deposit takes a parcel: « Déposé », or « Notifié » when its
 * e-mail left during the tour (§3.7.9). No new e-mail, and the reminders count
 * from this deposit.
 */
export function depositedStatus(
  parcel: Pick<StatusFields, 'lastNotifiedAt'>,
): 'depose' | 'notifie' {
  return parcel.lastNotifiedAt ? 'notifie' : 'depose';
}
