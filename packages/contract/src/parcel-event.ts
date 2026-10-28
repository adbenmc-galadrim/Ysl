import { z } from 'zod';
import { HANDOVER_METHODS, type HandoverMethod } from './handover';
import { IMPORT_FLAGS, type ImportFlag } from './imports';
import { DAMAGE_REASONS, type DamageReason } from './parcel-damage';
import { NOTIFICATION_TYPES, type NotificationType } from './mail/templates';
import { PARCEL_STATUSES, type ParcelStatus } from './parcel-status';
import { REPLY_KINDS } from './parcel-reply';
import type { RecipientKind } from './recipient/match';

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
    }
  | {
      /** Handed over: the `handover` row holds who collected it and how. */
      type: 'parcel.delivered';
      handoverId: string;
      method: HandoverMethod;
    }
  | ParcelReplyEvent;

/**
 * The recipient's answer as the agent reported it (YSL-70). « Pas pour
 * moi » keeps who the parcel was set for, the lesson to unlearn (§4.8);
 * a colleague, their name; an absence, the last day away (`YYYY-MM-DD`).
 */
export type ParcelReplyEvent =
  | {
      type: 'parcel.reply';
      reply: 'not_mine';
      previous: { kind: RecipientKind; id: string; name: string } | null;
    }
  | { type: 'parcel.reply'; reply: 'colleague'; delegate: string }
  | { type: 'parcel.reply'; reply: 'absent'; until: string };

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
  'parcel.delivered': z.object({
    handoverId: z.string(),
    method: z.enum(HANDOVER_METHODS),
  }),
  'parcel.reply': z.discriminatedUnion('reply', [
    z.object({
      reply: z.literal(REPLY_KINDS[0]),
      previous: z
        .object({
          kind: z.enum(['person', 'contact']),
          id: z.string(),
          name: z.string(),
        })
        .nullish()
        .transform((previous) => previous ?? null),
    }),
    z.object({ reply: z.literal(REPLY_KINDS[1]), delegate: z.string() }),
    z.object({
      reply: z.literal(REPLY_KINDS[2]),
      until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ]),
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
    case 'parcel.delivered':
      return {
        type: event.type,
        detail: { handoverId: event.handoverId, method: event.method },
      };
    case 'parcel.reply': {
      const { type, ...detail } = event;
      return { type, detail };
    }
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
    case 'parcel.delivered': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, ...read.data } : undefined;
    }
    case 'parcel.reply': {
      const read = details[type].safeParse(detail);
      return read.success ? { type, ...read.data } : undefined;
    }
    default:
      return undefined;
  }
}
