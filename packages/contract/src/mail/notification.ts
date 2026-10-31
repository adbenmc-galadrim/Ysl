import { z } from 'zod';
import {
  type ParcelStatus,
  statusPatch,
  type StatusFields,
  type StatusWrite,
} from '../parcel-status';
import { MAIL_CHANNELS, type DeliveryStatus } from './outbox';
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
export const RELAY_NAME_MAX = 200;

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
  /** Told through this colleague or assistant, at `recipients` (YSL-72). */
  relayName: z.string().trim().min(1).max(RELAY_NAME_MAX).nullish(),
  /** Absent from an iPhone of before: the phone. */
  channel: z.enum(MAIL_CHANNELS).optional(),
});

export type NotificationRow = z.infer<typeof notificationRow>;

/**
 * Why a parcel of a sent mail did not move: handed over or deleted, still to
 * complete, nobody on it, or not on this iPhone.
 */
export type NotifySkip = 'closed' | 'incomplete' | 'no-recipient' | 'missing';

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
 * Every mail that left about this parcel bounced: the next one is the first
 * the recipient reads, whatever the parcel's status says (YSL-113).
 */
export function reachedNobody(
  parcelId: string,
  mails: readonly {
    parcelIds: readonly string[];
    sentAt: Date | null;
    deliveryStatus?: DeliveryStatus | null;
    deletedAt?: Date | null;
  }[],
): boolean {
  const left = mails.filter(
    (mail) =>
      !mail.deletedAt && mail.sentAt && mail.parcelIds.includes(parcelId),
  );
  return (
    left.length > 0 && left.every((mail) => mail.deliveryStatus === 'bounced')
  );
}

/**
 * What a confirmed e-mail does to each of its parcels (§8.3): a received one
 * becomes notified, a notified one records the reminder in `lastNotifiedAt`,
 * keeping its first notice. `firstRead`: nothing reached the recipient before
 * (`reachedNobody`), so this mail is the notice, and J+2 runs from it. A parcel
 * already handed over, returned, to settle, deleted, still to complete or with
 * nobody on it stays as it is. On tour (§3.7.9), the mail is traced and the parcel stays
 * « En route » until its deposit (`depositedStatus`).
 */
export function notifyParcel(
  parcel: NotifiableParcel,
  {
    sentAt,
    agentId,
    firstRead = false,
  }: { sentAt: Date; agentId: string; firstRead?: boolean },
): NotifyChange {
  const parcelId = parcel.id;
  if (
    parcel.deletedAt ||
    parcel.status === 'remis' ||
    parcel.status === 'retourne' ||
    parcel.status === 'a_regulariser'
  ) {
    return { parcelId, skip: 'closed' };
  }
  if (parcel.status === 'a_completer') return { parcelId, skip: 'incomplete' };
  if (!parcel.personId && !parcel.contactId) {
    return { parcelId, skip: 'no-recipient' };
  }
  if (parcel.status === 'en_route') {
    if (parcel.lastNotifiedAt) return { parcelId, skip: 'closed' };
    return {
      parcelId,
      from: parcel.status,
      reminder: false,
      patch: {
        status: 'en_route',
        statusSeq: parcel.statusSeq ?? 0,
        notifiedAt: null,
        lastNotifiedAt: sentAt,
        deliveredAt: null,
        deliveredBy: null,
        depositedAt: null,
      },
    };
  }
  if (parcel.status === 'notifie') {
    return {
      parcelId,
      from: parcel.status,
      reminder: !firstRead,
      patch: {
        status: 'notifie',
        statusSeq: parcel.statusSeq ?? 0,
        notifiedAt: firstRead ? sentAt : (parcel.notifiedAt ?? sentAt),
        lastNotifiedAt: sentAt,
        deliveredAt: null,
        deliveredBy: null,
        depositedAt: parcel.depositedAt ?? null,
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
