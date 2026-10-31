import { z } from 'zod';
import type { HandoverMethod } from './handover';
import { PARCEL_STATUSES, type ParcelStatus } from './parcel-status';

export const STEP_STATES = ['disabled', 'optional', 'required'] as const;

export type StepState = (typeof STEP_STATES)[number];

export const DEPOSIT_CONFIRMATIONS = ['disabled', 'count', 'each'] as const;

export const EMAIL_MOMENTS = ['scan', 'deposit'] as const;

const stepState = z.enum(STEP_STATES);

const shape = {
  shuttleActsAsDepartment: z.boolean(),
  batchReview: stepState,
  depositConfirmation: z.enum(DEPOSIT_CONFIRMATIONS),
  handoverProof: stepState,
  handoverScan: stepState,
  signature: stepState,
  photo: stepState,
  emailMoment: z.enum(EMAIL_MOMENTS),
  reminders: stepState,
};

/** What a company turned on (§3.7.4, D30): read each time, so a change holds for every parcel (D31). */
export const operatingProfile = z.strictObject(shape);

export type OperatingProfile = z.infer<typeof operatingProfile>;

export type OperatingParam = keyof OperatingProfile;

export const OPERATING_PARAMS = Object.keys(shape) as OperatingParam[];

/** The `setting` row: written by the server only, read by every device. */
export const OPERATING_PROFILE_KEY = 'operatingProfile';

/** A company with no saved profile: what the app did before there was one. */
export const DEFAULT_OPERATING_PROFILE: OperatingProfile = {
  shuttleActsAsDepartment: false,
  batchReview: 'optional',
  depositConfirmation: 'disabled',
  handoverProof: 'optional',
  handoverScan: 'disabled',
  signature: 'optional',
  photo: 'optional',
  emailMoment: 'scan',
  reminders: 'optional',
};

/** « Petit site, la navette remet » (ME18): the converted agent keeps the handover (§3.7.9). */
export const SMALL_SITE_OPERATING_PROFILE: OperatingProfile = {
  ...DEFAULT_OPERATING_PROFILE,
  shuttleActsAsDepartment: true,
};

/** A stored value this version cannot read counts as no profile. Unknown fields are a later version's. */
export function parseOperatingProfile(value: unknown): OperatingProfile {
  const parsed = z.object(shape).safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_OPERATING_PROFILE;
}

export type ReminderMode = 'none' | 'manual' | 'automatic';

/** Reminders have no optional gesture: by hand when optional, by themselves when required (§3.7.9). */
export function reminderMode(state: StepState): ReminderMode {
  if (state === 'disabled') return 'none';
  return state === 'optional' ? 'manual' : 'automatic';
}

/** Proof turned off: the handover goes by the name and says so (§3.7.9). */
export const HANDOVER_METHOD_WITHOUT_PROOF: HandoverMethod = 'manuel';

export type ParcelCounts = Partial<Record<ParcelStatus, number>>;

/** The parcels under way each parameter applies to. */
const TOUCHED_STATUSES: Record<OperatingParam, readonly ParcelStatus[]> = {
  shuttleActsAsDepartment: ['recu', 'en_route', 'depose', 'notifie'],
  batchReview: ['a_completer'],
  depositConfirmation: ['en_route'],
  handoverProof: ['recu', 'depose', 'notifie'],
  handoverScan: ['recu', 'depose', 'notifie'],
  signature: ['recu', 'depose', 'notifie'],
  photo: ['recu', 'depose', 'notifie'],
  emailMoment: ['en_route', 'depose'],
  reminders: ['notifie'],
};

const countOf = (statuses: Iterable<ParcelStatus>, counts: ParcelCounts) =>
  [...statuses].reduce((sum, status) => sum + (counts[status] ?? 0), 0);

export type OperatingChange = {
  [Param in OperatingParam]: {
    param: Param;
    from: OperatingProfile[Param];
    to: OperatingProfile[Param];
    parcels: number;
  };
}[OperatingParam];

export type OperatingImpact = {
  changes: OperatingChange[];
  /** Each parcel once, even when several changes touch it. */
  parcels: number;
};

/** What the screen announces before saving (ME17). */
export function operatingImpact(
  from: OperatingProfile,
  to: OperatingProfile,
  counts: ParcelCounts,
): OperatingImpact {
  const changed = OPERATING_PARAMS.filter((param) => from[param] !== to[param]);
  return {
    changes: changed.map(
      (param) =>
        ({
          param,
          from: from[param],
          to: to[param],
          parcels: countOf(TOUCHED_STATUSES[param], counts),
        }) as OperatingChange,
    ),
    parcels: countOf(
      new Set(changed.flatMap((param) => TOUCHED_STATUSES[param])),
      counts,
    ),
  };
}

export const operatingSettings = z.object({
  profile: operatingProfile,
  counts: z.partialRecord(
    z.enum(PARCEL_STATUSES),
    z.number().int().nonnegative(),
  ),
});

export type OperatingSettings = z.infer<typeof operatingSettings>;

export const saveOperatingProfileInput = z.object({
  profile: operatingProfile,
});

export const saveOperatingProfileOutput = operatingSettings.extend({
  /** The parcels the saved change applies to; none when nothing changed. */
  applied: z.number().int().nonnegative(),
});
