import { z } from 'zod';
import { IMPORT_FLAGS, type ImportFlag } from './imports';
import { DAMAGE_REASONS, type DamageReason } from './parcel-damage';
import { NOTIFICATION_TYPES, type NotificationType } from './mail/templates';
import { PARCEL_STATUSES, type ParcelStatus } from './parcel-status';

/** The `entity` of the `event` rows that tell a parcel's story. */
export const PARCEL_EVENT_ENTITY = 'parcel';

/** What the record's form changes, named once for the history of every iPhone. */
export const PARCEL_EDIT_FIELDS = [
  'recipient',
  'tracking',
  'carrier',
  'sender',
  'pieces',
  'notes',
  'notificationEmail',
  'carrierService',
  'reference',
  'weightKg',
  'location',
] as const;

export type ParcelEditField = (typeof PARCEL_EDIT_FIELDS)[number];

/**
 * What happened to a parcel after its reception (F29), written by the app
 * that did it in the same write as the change. The reception itself is the
 * parcel row: `receivedAt`, `receivedBy`.
 */
export type ParcelEvent =
  | { type: 'parcel.edited'; fields: ParcelEditField[] }
  | { type: 'parcel.status'; from: ParcelStatus; to: ParcelStatus }
  | { type: 'parcel.deleted' }
  | { type: 'parcel.imported'; flags: ImportFlag[] }
  | {
      type: 'parcel.damaged';
      reason: DamageReason;
      note: string | null;
      notifyRecipient: boolean;
      carrierReserve: boolean;
      /** Photos taken on the iPhone that reported it; they stay there (D8). */
      photos: number;
    }
  | { type: 'parcel.damage_lifted'; reason: DamageReason }
  | {
      type: 'parcel.notified';
      notificationId: string;
      kind: NotificationType;
    };

const status = z.enum(PARCEL_STATUSES);
const reason = z.enum(DAMAGE_REASONS);

const details = {
  'parcel.edited': z.object({
    fields: z
      .array(z.string())
      .transform((fields) =>
        PARCEL_EDIT_FIELDS.filter((field) => fields.includes(field)),
      ),
  }),
  'parcel.status': z.object({ from: status, to: status }),
  'parcel.deleted': z.unknown(),
  'parcel.notified': z.object({
    notificationId: z.string(),
    kind: z.enum(NOTIFICATION_TYPES),
  }),
  'parcel.imported': z.object({
    flags: z
      .array(z.string())
      .transform((flags) =>
        IMPORT_FLAGS.filter((flag) => flags.includes(flag)),
      ),
  }),
  'parcel.damaged': z.object({
    reason,
    note: z
      .string()
      .nullish()
      .transform((note) => note ?? null),
    notifyRecipient: z.boolean().catch(false),
    carrierReserve: z.boolean().catch(false),
    photos: z.number().int().nonnegative().catch(0),
  }),
  'parcel.damage_lifted': z.object({ reason }),
} as const;

/** The `type` and `detail` columns of an event row. */
export function eventColumns(event: ParcelEvent): {
  type: ParcelEvent['type'];
  detail: Record<string, unknown> | null;
} {
  switch (event.type) {
    case 'parcel.edited':
      return { type: event.type, detail: { fields: event.fields } };
    case 'parcel.status':
      return { type: event.type, detail: { from: event.from, to: event.to } };
    case 'parcel.deleted':
      return { type: event.type, detail: null };
    case 'parcel.imported':
      return { type: event.type, detail: { flags: event.flags } };
    case 'parcel.damaged': {
      const { type, ...detail } = event;
      return { type, detail };
    }
    case 'parcel.damage_lifted':
      return { type: event.type, detail: { reason: event.reason } };
    case 'parcel.notified':
      return {
        type: event.type,
        detail: { notificationId: event.notificationId, kind: event.kind },
      };
  }
}

/**
 * An event row as any iPhone wrote it, back into a `ParcelEvent`; nothing
 * for a type this version does not know or a detail it cannot read, so an
 * older app skips what a newer one adds instead of failing the record.
 */
export function readParcelEvent(
  type: string,
  detail: unknown,
): ParcelEvent | undefined {
  switch (type) {
    case 'parcel.edited': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, fields: read.data.fields } : undefined;
    }
    case 'parcel.status': {
      const read = details[type].safeParse(detail);
      return read.success
        ? { type, from: read.data.from, to: read.data.to }
        : undefined;
    }
    case 'parcel.deleted':
      return { type };
    case 'parcel.imported': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, flags: read.data.flags } : undefined;
    }
    case 'parcel.damaged': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, ...read.data } : undefined;
    }
    case 'parcel.damage_lifted': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, reason: read.data.reason } : undefined;
    }
    case 'parcel.notified': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, ...read.data } : undefined;
    }
    default:
      return undefined;
  }
}
