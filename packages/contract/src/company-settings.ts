import { z } from 'zod';
import {
  RETENTION,
  type RetentionDuration,
  type RetentionKey,
} from './retention';

/** The `setting` row of a company's own settings (D28): written by the server only, read by every device. */
export const COMPANY_SETTINGS_KEY = 'company';

export const COMPANY_NAME_MAX = 120;

/** What a company may set, its unit fixed, within these bounds (§9.2 for the defaults). */
export const RETENTION_LIMITS = {
  photo: { unit: 'day', min: 1, max: 90 },
  extraction: { unit: 'day', min: 1, max: 90 },
  parcel: { unit: 'month', min: 1, max: 60 },
  signature: { unit: 'month', min: 1, max: 60 },
  contact: { unit: 'month', min: 1, max: 60 },
  // Under a week, a mail waiting for its webhook or its reminder could lose its row.
  emailOutbox: { unit: 'day', min: 7, max: 90 },
} as const satisfies Partial<
  Record<
    RetentionKey,
    { unit: RetentionDuration['unit']; min: number; max: number }
  >
>;

export type CompanyRetentionKey = keyof typeof RETENTION_LIMITS;

export const COMPANY_RETENTION_KEYS = Object.keys(
  RETENTION_LIMITS,
) as CompanyRetentionKey[];

/** Amounts in the unit of `RETENTION_LIMITS`; a key left out keeps its default. */
export const retentionAmounts = z.partialRecord(
  z.enum(
    COMPANY_RETENTION_KEYS as [CompanyRetentionKey, ...CompanyRetentionKey[]],
  ),
  z.number().int().positive(),
);

export type RetentionAmounts = z.infer<typeof retentionAmounts>;

export type ResolvedRetention = Record<RetentionKey, RetentionDuration>;

const within = (key: CompanyRetentionKey, amount: number | undefined) =>
  amount !== undefined &&
  amount >= RETENTION_LIMITS[key].min &&
  amount <= RETENTION_LIMITS[key].max;

/**
 * The durations of a company: its own where it has one in bounds, and for
 * anything else exactly what the app applied before D28.
 */
export function resolveRetention(
  amounts: RetentionAmounts | undefined,
): ResolvedRetention {
  const resolved: ResolvedRetention = { ...RETENTION };
  for (const key of COMPANY_RETENTION_KEYS) {
    const amount = amounts?.[key];
    if (within(key, amount)) {
      resolved[key] = { amount: amount!, unit: RETENTION_LIMITS[key].unit };
    }
  }
  // A handover goes with its parcel, its signature with it on every iPhone.
  if (resolved.signature.amount > resolved.parcel.amount) {
    resolved.signature = resolved.parcel;
  }
  return resolved;
}

export type RetentionProblem = 'bounds' | 'signatureOutlivesParcel';

/**
 * A handover goes with its parcel, and an iPhone drops the signature of a
 * handover it no longer holds: asking for a longer signature duration would be
 * a promise the purge does not keep. Left to its default, it simply follows.
 */
export function retentionProblem(
  amounts: RetentionAmounts,
): RetentionProblem | null {
  for (const key of COMPANY_RETENTION_KEYS) {
    if (amounts[key] !== undefined && !within(key, amounts[key])) {
      return 'bounds';
    }
  }
  const { parcel } = resolveRetention(amounts);
  return amounts.signature !== undefined && amounts.signature > parcel.amount
    ? 'signatureOutlivesParcel'
    : null;
}

export const POSTAL_CODE_MAX = 12;
export const ANCHOR_MAX = 60;
export const ANCHORS_MAX = 12;

/**
 * Where a company receives its parcels (ME34): the postal code a label should
 * name, and how its own name and street print, which never name a person.
 */
export const companyReception = z.object({
  postalCode: z
    .string()
    .trim()
    .min(1)
    .max(POSTAL_CODE_MAX)
    .transform((value) => value.replace(/\s+/g, '')),
  anchors: z.array(z.string().trim().min(1).max(ANCHOR_MAX)).max(ANCHORS_MAX),
});

export type CompanyReception = z.infer<typeof companyReception>;

/** The value of the row; each part unreadable falls back on its own default. */
export const companySettings = z.object({
  retention: retentionAmounts.optional().catch(undefined),
  reception: companyReception.nullable().optional().catch(null),
  logoId: z.uuid().nullable().optional().catch(null),
});

export type CompanySettings = z.infer<typeof companySettings>;

export const EMPTY_COMPANY_SETTINGS: CompanySettings = {};

/** A company with no row yet keeps every default: durations, no address, no logo. */
export function parseCompanySettings(value: unknown): CompanySettings {
  const parsed = companySettings.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_COMPANY_SETTINGS;
}

export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_MAX_SIDE = 4096;
export const LOGO_MIN_SIDE = 16;
export const LOGO_TYPES = ['image/png', 'image/jpeg'] as const;

export type LogoType = (typeof LOGO_TYPES)[number];

export type LogoProblem = 'type' | 'size' | 'dimensions';

/** The path the server serves a logo from: public, an e-mail client has no session. */
export const logoPath = (logoId: string) => `/api/logos/${logoId}`;

export const saveIdentityInput = z.object({
  name: z.string().trim().min(1).max(COMPANY_NAME_MAX),
});

/** Base64: 4 characters for 3 bytes, the size itself checked on the decoded bytes. */
export const saveLogoInput = z.object({
  contentBase64: z
    .string()
    .min(1)
    .max(Math.ceil(LOGO_MAX_BYTES / 3) * 4),
});

export const saveLogoOutput = z.object({ logoId: z.string() });

export const saveReceptionInput = z.object({
  reception: companyReception.nullable(),
});

export const retentionInput = z.object({ retention: retentionAmounts });

/** What lowering the durations takes at the next purge, as the server can count it. */
export const retentionImpact = z.object({
  parcels: z.number().int().nonnegative(),
  contacts: z.number().int().nonnegative(),
  emails: z.number().int().nonnegative(),
  /** Handovers whose signature or photo goes: the files are on the iPhones (D8). */
  proofs: z.number().int().nonnegative(),
  /** Label photos and readings live on the iPhones only: the server cannot count them. */
  deviceOnly: z.array(z.enum(['photo', 'extraction'])),
});

export type RetentionImpact = z.infer<typeof retentionImpact>;

export const impactRows = (impact: RetentionImpact) =>
  impact.parcels + impact.contacts + impact.emails + impact.proofs;

export const saveRetentionInput = retentionInput.extend({
  /** The rows the screen announced: more than that now, and it announces again. */
  announced: z.number().int().nonnegative(),
});

export const saveRetentionOutput = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), retention: retentionAmounts }),
  z.object({ status: z.literal('changed'), impact: retentionImpact }),
]);

export const companySettingsOutput = z.object({
  name: z.string(),
  logoId: z.string().nullable(),
  reception: companyReception.nullable(),
  retention: retentionAmounts,
  departments: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      replyEmail: z.string().nullable(),
    }),
  ),
});

export type CompanySettingsOutput = z.infer<typeof companySettingsOutput>;

export const saveDepartmentReplyInput = z.object({
  id: z.uuid(),
  replyEmail: z.email().max(254).nullable(),
});

/** How a label prints France, the only country of the MVP. */
export const RECEPTION_COUNTRIES = ['FR', 'FRA', 'FRANCE', '250'] as const;
