import {
  canMoveNotification,
  FAILED_REASON_MAX,
  notifyParcel,
  type MailTarget,
  type NotificationStatus,
  type NotificationType,
  type NotifyChange,
} from '@repo/contract/mail';
import { newId } from '@repo/shared/id';
import {
  commitLocal,
  MissingRowError,
  type Upsert,
} from '#/features/db/commit';
import type { CourrierDatabase, LocalNotification } from '#/features/db/schema';
import {
  pickupCodeWrites,
  type PickupSecret,
} from '#/features/mail/pickup-code';
import { parcelEvent } from '#/features/parcels/events';

export type PrepareNotification = {
  type: NotificationType;
  personId?: string | null;
  contactId?: string | null;
  recipients: readonly string[];
  cc?: readonly string[];
  parcelIds: readonly string[];
  templateId: string | null;
  /** Null when the mail leaves by the share sheet: no app is chosen. */
  target: MailTarget | null;
  /** The pickup code the mail quotes, made the recipient's in the same write. */
  pickup?: PickupSecret;
  /** Sent to this colleague or assistant for the recipient, who has no address (F25). */
  relayName?: string | null;
};

export type NotificationOptions = { userId: string; now?: Date };

export class NotificationStateError extends Error {
  constructor(
    readonly from: NotificationStatus,
    readonly to: NotificationStatus,
  ) {
    super(`A mail cannot go from ${from} to ${to}`);
    this.name = 'NotificationStateError';
  }
}

async function liveNotification(
  db: CourrierDatabase,
  id: string,
): Promise<LocalNotification> {
  const row = await db.notification.get(id);
  if (!row || row.deletedAt) throw new MissingRowError('notification', id);
  return row;
}

/** Rows pulled before the column read as prepared, or sent when dated. */
export function statusOf(row: LocalNotification): NotificationStatus {
  return row.status ?? (row.sentAt ? 'sent' : 'prepared');
}

/**
 * The mail about to open in the mail app, recorded before the tap (S5: the
 * app can only tell it opened the mail app). Its text is not kept: it holds
 * the pickup code in clear, and the agent's mail app has the sent copy. The
 * code it quotes becomes the recipient's at the same time, whatever the
 * agent says next: a mail that did not go leaves a code nobody holds.
 */
export async function prepareNotification(
  db: CourrierDatabase,
  input: PrepareNotification,
  { userId, now = new Date() }: NotificationOptions,
): Promise<LocalNotification> {
  const row: LocalNotification = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    type: input.type,
    personId: input.personId ?? null,
    contactId: input.contactId ?? null,
    recipients: [...input.recipients],
    cc: [...(input.cc ?? [])],
    parcelIds: [...input.parcelIds],
    templateId: input.templateId,
    status: 'prepared',
    target: input.target,
    preparedAt: now,
    preparedBy: userId,
    openedAt: null,
    sentAt: null,
    failedReason: null,
    relayName: input.relayName ?? null,
  };
  const codes = input.pickup
    ? await pickupCodeWrites(
        db,
        { personId: row.personId, contactId: row.contactId },
        input.pickup,
        { now },
      )
    : [];
  await commitLocal(
    db,
    { upserts: [...codes, { entity: 'notification', row }] },
    { now },
  );
  return row;
}

async function move(
  db: CourrierDatabase,
  id: string,
  to: NotificationStatus,
  changes: (row: LocalNotification) => Partial<LocalNotification>,
  {
    now = new Date(),
    also = () => [],
  }: {
    now?: Date;
    also?: (row: LocalNotification) => Promise<Upsert[]> | Upsert[];
  },
): Promise<LocalNotification> {
  const row = await liveNotification(db, id);
  const from = statusOf(row);
  if (from === to) return row;
  if (!canMoveNotification(from, to))
    throw new NotificationStateError(from, to);
  const next: LocalNotification = { ...row, ...changes(row), status: to };
  await commitLocal(
    db,
    {
      upserts: [{ entity: 'notification', row: next }, ...(await also(next))],
    },
    { now },
  );
  return next;
}

/** The page went to the background right after the tap: the mail app opened. */
export function markOpened(
  db: CourrierDatabase,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<LocalNotification> {
  return move(db, id, 'opened', () => ({ openedAt: now, failedReason: null }), {
    now,
  });
}

/**
 * The agent tries another mail app for the same mail: the log keeps the
 * last one tried, the one that opened or the one given up on. `null` when
 * the text left by copy or share, through an app the log cannot name.
 */
export async function retargetNotification(
  db: CourrierDatabase,
  id: string,
  target: MailTarget | null,
  { now = new Date() }: { now?: Date } = {},
): Promise<LocalNotification> {
  const row = await liveNotification(db, id);
  if (row.target === target || statusOf(row) === 'sent') return row;
  const next: LocalNotification = { ...row, target };
  await commitLocal(
    db,
    { upserts: [{ entity: 'notification', row: next }] },
    { now },
  );
  return next;
}

/** The agent says it did not go: why, in their words. */
export function markFailed(
  db: CourrierDatabase,
  id: string,
  reason: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<LocalNotification> {
  return move(
    db,
    id,
    'failed',
    () => ({
      failedReason: reason.trim().slice(0, FAILED_REASON_MAX) || '—',
    }),
    { now },
  );
}

export type SentResult = {
  notification: LocalNotification;
  changes: NotifyChange[];
};

/**
 * The agent confirms the mail left: its parcels become notified (§8.3), a
 * reminder is dated on those already notified, and each gets its history
 * line, all in the same write as the mail. A parcel handed over meanwhile,
 * or with nobody on it, stays as it is.
 */
export async function markSent(
  db: CourrierDatabase,
  id: string,
  { userId, now = new Date() }: NotificationOptions,
): Promise<SentResult> {
  let changes: NotifyChange[] = [];
  const notification = await move(
    db,
    id,
    'sent',
    () => ({ sentAt: now, failedReason: null }),
    {
      now,
      also: async (row) => {
        const parcels = await db.parcel.bulkGet(row.parcelIds);
        changes = row.parcelIds.map((parcelId, index) => {
          const parcel = parcels[index];
          return parcel
            ? notifyParcel(parcel, { sentAt: now, agentId: userId })
            : { parcelId, skip: 'missing' };
        });
        return changes.flatMap((change, index): Upsert[] => {
          const parcel = parcels[index];
          if ('skip' in change || !parcel) return [];
          return [
            { entity: 'parcel', row: { ...parcel, ...change.patch } },
            parcelEvent(
              change.parcelId,
              {
                type: 'parcel.notified',
                notificationId: row.id,
                kind: change.reminder ? 'relance' : row.type,
              },
              { agentId: userId, now },
            ),
          ];
        });
      },
    },
  );
  return { notification, changes };
}
