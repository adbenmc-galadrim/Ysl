import type { TranslationKey } from '@repo/shared/i18n';

export const PARCEL_STATUSES = [
  'a_completer',
  'recu',
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
  recu: ['notifie', 'remis', 'retourne'],
  notifie: ['remis', 'retourne'],
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
  notifie: ['recu'],
  remis: ['notifie', 'recu'],
  retourne: ['notifie', 'recu'],
};

/** Staying put is always allowed. */
export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return (
    from === to ||
    FORWARD_TRANSITIONS[from].includes(to) ||
    BACKWARD_TRANSITIONS[from].includes(to)
  );
}

export function isStepBack(from: ParcelStatus, to: ParcelStatus): boolean {
  return BACKWARD_TRANSITIONS[from].includes(to);
}

/** The statuses the home list follows until the parcel leaves the desk. */
export const OPEN_STATUSES = [
  'a_completer',
  'recu',
  'notifie',
] as const satisfies readonly ParcelStatus[];

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
  notifie: 'parcel.state.notifie',
  remis: 'parcel.state.remis',
  retourne: 'parcel.state.retourne',
} as const satisfies Record<ParcelStatus, TranslationKey>;

/** §8.3: what is left to do, said by the status itself. */
export const STATUS_TODO = {
  a_completer: 'parcel.todo.a_completer',
  recu: 'parcel.todo.recu',
  notifie: 'parcel.todo.notifie',
  remis: 'parcel.todo.remis',
  retourne: 'parcel.todo.retourne',
} as const satisfies Record<ParcelStatus, TranslationKey>;

/** The undo action of a status, named after the step it takes back. */
export const STEP_BACK_LABEL = {
  recu: 'parcel.undo.recu',
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
};

/** Where undoing the last step leads: a parcel never notified goes back to `recu`. */
export function stepBackOf(
  parcel: Pick<StatusFields, 'status' | 'notifiedAt'>,
): ParcelStatus | undefined {
  switch (parcel.status) {
    case 'a_completer':
      return undefined;
    case 'recu':
      return 'a_completer';
    case 'notifie':
      return 'recu';
    case 'remis':
    case 'retourne':
      return parcel.notifiedAt ? 'notifie' : 'recu';
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

export type StatusWrite = Omit<StatusFields, 'statusSeq'> & {
  statusSeq: number;
};

export type StatusChangeContext = { now: Date; agentId: string };

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
  const unnotified = to === 'a_completer' || to === 'recu';
  return {
    status: to,
    statusSeq: (parcel.statusSeq ?? 0) + 1,
    notifiedAt: unnotified
      ? null
      : to === 'notifie'
        ? (parcel.notifiedAt ?? now)
        : parcel.notifiedAt,
    lastNotifiedAt: unnotified ? null : parcel.lastNotifiedAt,
    deliveredAt: to === 'remis' ? now : null,
    deliveredBy: to === 'remis' ? agentId : null,
  };
}
