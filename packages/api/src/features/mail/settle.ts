import { eventColumns, PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import { noticeDue, notifyParcel, reachedNobody } from '@repo/contract/mail';
import type { AnyDb } from '@repo/db';
import { event, notification, parcel, pickupCode } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import {
  and,
  arrayOverlaps,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import { noticeRule } from '#features/operating/service';

/** A reminder asked this soon after a mail repeats it: a second tap, a stale screen. */
const RECENT_MS = 60 * 60_000;

/** A request this old is not sent any more: the phone had all the time to take over. */
export const REQUEST_MAX_AGE_MS = 3 * 24 * 60 * 60_000;

type Request = typeof notification.$inferSelect;
type Parcel = typeof parcel.$inferSelect;

export async function earlierMails(tx: AnyDb, row: Request) {
  return tx
    .select({
      parcelIds: notification.parcelIds,
      sentAt: notification.sentAt,
      deliveryStatus: notification.deliveryStatus,
      deletedAt: notification.deletedAt,
    })
    .from(notification)
    .where(
      and(
        eq(notification.organizationId, row.organizationId),
        ne(notification.id, row.id),
        isNotNull(notification.sentAt),
        arrayOverlaps(notification.parcelIds, row.parcelIds),
      ),
    );
}

/**
 * The parcels a request may still tell. A notice: those whose moment has come
 * (ME29), and those told whose every mail bounced. A reminder: those notified. What
 * the phone told in the meantime leaves the list, so no mail goes twice. `early`:
 * only the moment holds them back, which is what the agent is told.
 */
export async function parcelsToTell(
  tx: AnyDb,
  row: Request,
): Promise<{ parcels: Parcel[]; firstRead: boolean; early: boolean }> {
  const rows = await tx
    .select()
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, row.organizationId),
        inArray(parcel.id, row.parcelIds),
        isNull(parcel.deletedAt),
      ),
    );
  const before = await earlierMails(tx, row);
  const rule = await noticeRule(tx, row.organizationId);
  const bounced = (id: string) => reachedNobody(id, before);
  const traced = (item: Parcel) =>
    item.status === 'notifie' ||
    (item.status === 'en_route' && rule.atScan && item.lastNotifiedAt !== null);
  const others = await tx
    .select({
      parcelIds: notification.parcelIds,
      channel: notification.channel,
      status: notification.status,
      preparedAt: notification.preparedAt,
    })
    .from(notification)
    .where(
      and(
        eq(notification.organizationId, row.organizationId),
        ne(notification.id, row.id),
        isNull(notification.deletedAt),
        arrayOverlaps(notification.parcelIds, row.parcelIds),
      ),
    );
  // Another request (a double tap, two devices), or the phone that took over
  // after this one, even before the agent says the mail left.
  const claimed = new Set(
    others
      .filter((other) =>
        other.channel === 'server'
          ? other.status === 'prepared'
          : other.status !== 'failed' && other.preparedAt > row.preparedAt,
      )
      .flatMap((other) => other.parcelIds),
  );
  const justReminded = (id: string) =>
    before.some(
      (mail) =>
        mail.parcelIds.includes(id) &&
        mail.deliveryStatus !== 'bounced' &&
        row.preparedAt.getTime() - mail.sentAt!.getTime() < RECENT_MS,
    );
  const parcels = rows.filter((item) => {
    if (!item.personId && !item.contactId) return false;
    if (claimed.has(item.id)) return false;
    if (row.type === 'relance' && justReminded(item.id)) return false;
    if (row.type === 'relance') return item.status === 'notifie';
    return noticeDue(item, rule) || (traced(item) && bounced(item.id));
  });
  const notified = parcels.filter(traced);
  return {
    parcels,
    firstRead:
      notified.length > 0 && notified.every((item) => bounced(item.id)),
    early:
      row.type !== 'relance' &&
      parcels.length === 0 &&
      rows.some(
        (item) =>
          !claimed.has(item.id) &&
          (item.status === 'recu' || item.status === 'en_route') &&
          !item.lastNotifiedAt,
      ),
  };
}

/** The mail left: its parcels are told, in the same transaction as the queue's row. */
export async function settleSent(
  tx: AnyDb,
  notificationId: string,
  now: Date,
): Promise<void> {
  const [row] = await tx
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.channel, 'server'),
        eq(notification.status, 'prepared'),
      ),
    );
  if (!row) return;
  await tx
    .update(notification)
    .set({ status: 'sent', sentAt: now, failedReason: null, updatedAt: now })
    .where(eq(notification.id, row.id));
  const before = await earlierMails(tx, row);
  const { tour } = await noticeRule(tx, row.organizationId);
  const parcels = await tx
    .select()
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, row.organizationId),
        inArray(parcel.id, row.parcelIds),
      ),
    );
  for (const item of parcels) {
    const firstRead = reachedNobody(item.id, before);
    const change = notifyParcel(item, {
      sentAt: now,
      agentId: row.preparedBy,
      firstRead,
      tour,
    });
    if ('skip' in change) continue;
    await tx
      .update(parcel)
      .set({ ...change.patch, updatedAt: now })
      .where(eq(parcel.id, item.id));
    await tx.insert(event).values({
      id: newId(),
      organizationId: row.organizationId,
      createdAt: now,
      updatedAt: now,
      entity: PARCEL_EVENT_ENTITY,
      entityId: item.id,
      actorId: row.preparedBy,
      at: now,
      ...eventColumns({
        type: 'parcel.notified',
        notificationId: row.id,
        kind: change.reminder ? 'relance' : firstRead ? 'avis' : row.type,
      }),
    });
  }
}

/**
 * The request ends without a mail: the parcels stay where they are, for the
 * phone. Whoever held the former code still holds a good one.
 */
export async function settleFailed(
  tx: AnyDb,
  notificationId: string,
  reason: string,
  codes: { pickupCodeId?: string | null; replacedCodeId?: string | null },
  now: Date,
): Promise<void> {
  await tx
    .update(notification)
    .set({ status: 'failed', failedReason: reason, updatedAt: now })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.channel, 'server'),
        eq(notification.status, 'prepared'),
      ),
    );
  if (codes.pickupCodeId) {
    await tx
      .update(pickupCode)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(eq(pickupCode.id, codes.pickupCodeId), isNull(pickupCode.usedAt)),
      );
  }
  if (codes.replacedCodeId) {
    await tx
      .update(pickupCode)
      .set({ deletedAt: null, updatedAt: now })
      .where(
        and(
          eq(pickupCode.id, codes.replacedCodeId),
          isNull(pickupCode.usedAt),
          gt(pickupCode.expiresAt, now),
          sql`not exists (
            select 1 from ${pickupCode} as live
            where live.organization_id = ${pickupCode.organizationId}
              and live.id <> ${pickupCode.id}
              and live.deleted_at is null
              and live.used_at is null
              and live.department_id = ${pickupCode.departmentId}
              and (live.person_id = ${pickupCode.personId} or live.contact_id = ${pickupCode.contactId})
          )`,
        ),
      );
  }
}
