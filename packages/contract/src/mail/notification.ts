import { z } from 'zod';
import {
  type ParcelStatus,
  statusPatch,
  type StatusFields,
  type StatusWrite,
} from '../parcel-status';
import { MAIL_TARGETS } from './urls';
import { NOTIFICATION_TYPES } from './templates';

/**
 * Where an e-mail stands (S5: nothing tells the app a mail left): prepared by
 * the app, `opened` once the mail app took over the screen, `sent` when the
 * agent says so, `failed` when the agent says it did not go.
 */
export const NOTIFICATION_STATUSES = [
  'prepared',
  'opened',
  'sent',
  'failed',
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

const NEXT: Record<NotificationStatus, readonly NotificationStatus[]> = {
  prepared: ['opened', 'sent', 'failed'],
  opened: ['sent', 'failed'],
  failed: ['opened', 'sent'],
  sent: [],
};

/** A sent mail stays sent; a failed one can be opened again. */
export function canMoveNotification(
  from: NotificationStatus,
  to: NotificationStatus,
): boolean {
  return NEXT[from].includes(to);
}

export const FAILED_REASON_MAX = 200;

/** The `notification` row as the app writes it (`sync.push` takes the same shape). */
export const notificationRow = z.object({
  id: z.uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  personId: z.uuid().nullable(),
  contactId: z.uuid().nullable(),
  recipients: z.array(z.string().min(1)).min(1),
  cc: z.array(z.string().min(1)),
  parcelIds: z.array(z.uuid()).min(1),
  templateId: z.uuid().nullable(),
  status: z.enum(NOTIFICATION_STATUSES),
  target: z.enum(MAIL_TARGETS).nullable(),
  preparedAt: z.date(),
  preparedBy: z.string().min(1),
  openedAt: z.date().nullable(),
  sentAt: z.date().nullable(),
  failedReason: z.string().max(FAILED_REASON_MAX).nullable(),
});

export type NotificationRow = z.infer<typeof notificationRow>;

/** Why a parcel of a sent mail did not move: already handed over, or nobody to notify. */
export type NotifySkip = 'closed' | 'incomplete' | 'no-recipient';

export type NotifiableParcel = StatusFields & {
  id: string;
  personId: string | null;
  contactId: string | null;
  deletedAt: Date | null;
};

export type NotifyChange =
  | {
      parcelId: string;
      patch: StatusWrite;
      from: ParcelStatus;
      reminder: boolean;
    }
  | { parcelId: string; skip: NotifySkip };

/**
 * What a confirmed e-mail does to each of its parcels (§8.3): a received one
 * becomes notified, a notified one records the reminder in `lastNotifiedAt`,
 * keeping its first notice. A parcel already handed over, returned, deleted,
 * still to complete or with nobody on it stays as it is.
 */
export function notifyParcel(
  parcel: NotifiableParcel,
  { sentAt, agentId }: { sentAt: Date; agentId: string },
): NotifyChange {
  const parcelId = parcel.id;
  if (
    parcel.deletedAt ||
    parcel.status === 'remis' ||
    parcel.status === 'retourne'
  ) {
    return { parcelId, skip: 'closed' };
  }
  if (parcel.status === 'a_completer') return { parcelId, skip: 'incomplete' };
  if (!parcel.personId && !parcel.contactId) {
    return { parcelId, skip: 'no-recipient' };
  }
  if (parcel.status === 'notifie') {
    return {
      parcelId,
      from: parcel.status,
      reminder: true,
      patch: {
        status: 'notifie',
        statusSeq: parcel.statusSeq ?? 0,
        notifiedAt: parcel.notifiedAt ?? sentAt,
        lastNotifiedAt: sentAt,
        deliveredAt: null,
        deliveredBy: null,
      },
    };
  }
  return {
    parcelId,
    from: parcel.status,
    reminder: false,
    patch: statusPatch(parcel, 'notifie', { now: sentAt, agentId }),
  };
}
