import {
  OPERATING_PROFILE_KEY,
  parseOperatingProfile,
  reminderMode,
} from '@repo/contract/operating-profile';
import { reachedNobody } from '@repo/contract/mail';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { knownReminders, reminderState } from '@repo/contract/reminders';
import type { AnyDb } from '@repo/db';
import {
  event,
  notification,
  organization,
  parcel,
  setting,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, arrayOverlaps, eq, inArray, isNull, sql } from 'drizzle-orm';

const ZONE = 'Europe/Paris';
const FIRST_HOUR = 8;
const LAST_HOUR = 18;

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  weekday: 'short',
  hour: 'numeric',
  hour12: false,
});

/** A reminder reaches the employee in the working day, not when the clock turns. */
export function inWorkingHours(now: Date): boolean {
  const parts = PARTS.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const day = parts.find((part) => part.type === 'weekday')?.value;
  return (
    day !== 'Sat' && day !== 'Sun' && hour >= FIRST_HOUR && hour < LAST_HOUR
  );
}

type Mail = typeof notification.$inferSelect;
type Parcel = typeof parcel.$inferSelect;

/** Whether a parcel gets no reminder from here, whatever the calendar says. */
function held(item: Parcel, mails: readonly Mail[]): boolean {
  const about = mails.filter(
    (mail) => !mail.deletedAt && mail.parcelIds.includes(item.id),
  );
  // Told by the phone, it stays the phone's: an iPhone of before reminds by itself.
  const noticedHere = about.some(
    (mail) => mail.channel === 'server' && mail.type === 'avis' && mail.sentAt,
  );
  if (!noticedHere || reachedNobody(item.id, about)) return true;
  const sent = about.flatMap((mail) => (mail.sentAt ? [mail] : []));
  const last = [...sent].sort(
    (a, b) => b.sentAt!.getTime() - a.sentAt!.getTime(),
  )[0];
  if (last?.deliveryStatus === 'bounced') return true;
  // On its way, or given up on since the last mail: once, never in a loop.
  return about.some(
    (mail) =>
      mail.channel === 'server' &&
      mail.type === 'relance' &&
      (mail.status === 'prepared' ||
        (mail.status === 'failed' &&
          (!last?.sentAt || mail.preparedAt > last.sentAt))),
  );
}

/**
 * The reminders the rule calls for (D12), for companies whose profile makes them
 * automatic (§3.7.9): a request per recipient and department, drawn and sent as
 * any other. A second run finds them on their way, then sent: each goes once.
 */
export async function requestDueReminders(
  db: AnyDb,
  now = new Date(),
): Promise<number> {
  if (!inWorkingHours(now)) return 0;
  // Each instance has its timer: only one looks at a time, the next sees its requests.
  return db.transaction(async (tx) => {
    const result = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('ysl.mail-reminders')) as free`,
    );
    const [lock] = (result as { rows: { free: boolean }[] }).rows;
    return lock?.free ? requestUnderLock(tx, now) : 0;
  });
}

async function requestUnderLock(db: AnyDb, now: Date): Promise<number> {
  const profiles = await db
    .select({ organizationId: setting.organizationId, value: setting.value })
    .from(setting)
    .innerJoin(organization, eq(organization.id, setting.organizationId))
    .where(
      and(
        eq(setting.key, OPERATING_PROFILE_KEY),
        isNull(setting.deletedAt),
        // No new reminder while suspended: it may be over for good. A mail already queued still leaves.
        isNull(organization.suspendedAt),
      ),
    );
  let requested = 0;
  for (const { organizationId, value } of profiles) {
    const { reminders } = parseOperatingProfile(value);
    if (reminderMode(reminders) !== 'automatic') continue;
    const parcels = await db
      .select()
      .from(parcel)
      .where(
        and(
          eq(parcel.organizationId, organizationId),
          eq(parcel.status, 'notifie'),
          isNull(parcel.deletedAt),
        ),
      );
    if (parcels.length === 0) continue;
    const ids = parcels.map((item) => item.id);
    const mails = await db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.organizationId, organizationId),
          arrayOverlaps(notification.parcelIds, ids),
        ),
      );
    const told = await db
      .select()
      .from(event)
      .where(
        and(
          eq(event.organizationId, organizationId),
          eq(event.type, 'parcel.informed'),
          inArray(event.entityId, ids),
        ),
      );
    const groups = new Map<string, Parcel[]>();
    for (const item of parcels) {
      if (!item.notifiedAt || held(item, mails)) continue;
      const known = [
        ...mails.flatMap((mail) =>
          mail.sentAt &&
          !mail.deletedAt &&
          mail.deliveryStatus !== 'bounced' &&
          mail.parcelIds.includes(item.id)
            ? [mail.sentAt]
            : [],
        ),
        ...told.flatMap((row) =>
          row.entityId === item.id &&
          readParcelEvent(row.type, row.detail)?.type === 'parcel.informed'
            ? [row.at]
            : [],
        ),
      ];
      const state = reminderState(
        {
          notifiedAt: item.notifiedAt,
          reminders: knownReminders(
            {
              notifiedAt: item.notifiedAt,
              lastNotifiedAt: item.lastNotifiedAt,
            },
            known,
          ),
          pausedUntil: item.remindersPausedUntil,
        },
        now,
      );
      if (!state.due) continue;
      const key = `${item.personId ?? item.contactId}|${item.departmentId}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) {
      const [first] = group;
      if (!first) continue;
      const notice = mails.find(
        (mail) =>
          mail.channel === 'server' &&
          mail.type === 'avis' &&
          mail.parcelIds.includes(first.id),
      );
      if (!notice) continue;
      const request = {
        id: newId(),
        organizationId,
        createdAt: now,
        updatedAt: now,
        type: 'relance' as const,
        personId: first.personId,
        contactId: first.personId ? null : first.contactId,
        recipients: notice.recipients,
        parcelIds: group.map((item) => item.id),
        status: 'prepared' as const,
        channel: 'server' as const,
        preparedAt: now,
        preparedBy: notice.preparedBy,
      };
      await db.insert(notification).values(request);
      requested += 1;
    }
  }
  return requested;
}
