import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';

/**
 * When each notified parcel was reminded: the mails confirmed sent after
 * its first notice, from every agent (all the mails are on the iPhone).
 * The notice itself is the parcel's `notifiedAt`, left out.
 */
export async function loadReminderDates(
  db: CourrierDatabase,
  parcels: readonly LocalParcel[],
): Promise<Map<string, Date[]>> {
  const notified = new Map(
    parcels
      .filter(
        (parcel) =>
          parcel.status === 'notifie' && !parcel.deletedAt && parcel.notifiedAt,
      )
      .map((parcel) => [parcel.id, parcel.notifiedAt!]),
  );
  const dates = new Map<string, Date[]>();
  if (!notified.size) return dates;
  const since = new Date(
    Math.min(...[...notified.values()].map((at) => at.getTime())),
  );
  const sent = await db.notification.where('sentAt').above(since).toArray();
  for (const mail of sent) {
    if (mail.deletedAt || !mail.sentAt) continue;
    for (const parcelId of mail.parcelIds) {
      const notice = notified.get(parcelId);
      if (!notice || mail.sentAt <= notice) continue;
      dates.set(parcelId, [...(dates.get(parcelId) ?? []), mail.sentAt]);
    }
  }
  return dates;
}
