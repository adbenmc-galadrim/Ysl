import { readParcelEvent } from '@repo/contract/parcel-event';
import { reminderMode } from '@repo/contract/operating-profile';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import type { ReminderDates } from '#/features/parcels/model';

/**
 * When each notified parcel was reminded: the mails confirmed sent after
 * its first notice, from every agent (all the mails are on the iPhone),
 * and the reminders given in person (YSL-72). The notice itself is the
 * parcel's `notifiedAt`, left out.
 */
export async function loadReminderDates(
  db: CourrierDatabase,
  parcels: readonly LocalParcel[],
): Promise<Map<string, Date[]> & ReminderDates> {
  const notified = new Map(
    parcels
      .filter(
        (parcel) =>
          parcel.status === 'notifie' && !parcel.deletedAt && parcel.notifiedAt,
      )
      .map((parcel) => [parcel.id, parcel.notifiedAt!]),
  );
  const dates: Map<string, Date[]> & ReminderDates = new Map<string, Date[]>();
  dates.remindersOff =
    reminderMode((await readOperatingProfile(db)).reminders) === 'none';
  if (!notified.size) return dates;
  const since = new Date(
    Math.min(...[...notified.values()].map((at) => at.getTime())),
  );
  const add = (parcelId: string, at: Date) => {
    const notice = notified.get(parcelId);
    if (!notice || at <= notice) return;
    dates.set(parcelId, [...(dates.get(parcelId) ?? []), at]);
  };
  const sent = await db.notification.where('sentAt').above(since).toArray();
  for (const mail of sent) {
    // A bounced mail reached nobody: it reminded no one.
    if (mail.deletedAt || !mail.sentAt || mail.deliveryStatus === 'bounced')
      continue;
    for (const parcelId of mail.parcelIds) add(parcelId, mail.sentAt);
  }
  const told = await db.event.where('at').above(since).toArray();
  for (const row of told) {
    if (readParcelEvent(row.type, row.detail)?.type === 'parcel.informed')
      add(row.entityId, row.at);
  }
  for (const at of dates.values()) at.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}
