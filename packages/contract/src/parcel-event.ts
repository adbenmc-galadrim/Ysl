import { z } from 'zod';
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
  | { type: 'parcel.deleted' };

const status = z.enum(PARCEL_STATUSES);

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
    default:
      return undefined;
  }
}
