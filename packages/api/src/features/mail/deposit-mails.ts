import type { AnyDb } from '@repo/db';
import {
  contact,
  directoryPerson,
  notification,
  parcel,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, arrayOverlaps, eq, inArray, isNull } from 'drizzle-orm';
import { serverMailEnabled } from '#features/mail/config';

type Parcel = typeof parcel.$inferSelect;
type Actor = { organizationId: string; userId: string };

/**
 * Asks the server's mail for parcels just deposited, one request per recipient
 * and per department, as a validated batch does on the phone. Whoever has no
 * address, or a server not sending, stays with the phone: nothing is lost, the
 * parcels wait in « À notifier ». The job draws the code and writes the text.
 */
export async function requestDepositMails(
  tx: AnyDb,
  { organizationId, userId }: Actor,
  parcels: readonly Parcel[],
  now: Date,
): Promise<number> {
  if (!serverMailEnabled() || parcels.length === 0) return 0;
  const asked = await tx
    .select({ parcelIds: notification.parcelIds })
    .from(notification)
    .where(
      and(
        eq(notification.organizationId, organizationId),
        eq(notification.channel, 'server'),
        eq(notification.status, 'prepared'),
        isNull(notification.deletedAt),
        arrayOverlaps(
          notification.parcelIds,
          parcels.map(({ id }) => id),
        ),
      ),
    );
  const onItsWay = new Set(asked.flatMap((row) => row.parcelIds));
  const toTell = parcels.filter(
    (one) => (one.personId || one.contactId) && !onItsWay.has(one.id),
  );
  const personIds = toTell.flatMap((one) => one.personId ?? []);
  const contactIds = toTell.flatMap((one) => one.contactId ?? []);
  const [people, contacts] = await Promise.all([
    personIds.length
      ? tx
          .select({ id: directoryPerson.id, email: directoryPerson.email })
          .from(directoryPerson)
          .where(inArray(directoryPerson.id, personIds))
      : [],
    contactIds.length
      ? tx
          .select({ id: contact.id, email: contact.email })
          .from(contact)
          .where(inArray(contact.id, contactIds))
      : [],
  ]);
  const addressOf = (one: Parcel) =>
    one.notificationEmail?.trim() ||
    people.find(({ id }) => id === one.personId)?.email.trim() ||
    contacts.find(({ id }) => id === one.contactId)?.email?.trim() ||
    null;
  const groups = new Map<string, { address: string; parcels: Parcel[] }>();
  for (const one of toTell) {
    const address = addressOf(one);
    if (!address) continue;
    const key = `${one.personId ?? one.contactId}|${one.departmentId}`;
    const group = groups.get(key) ?? { address, parcels: [] };
    group.parcels.push(one);
    groups.set(key, group);
  }
  for (const { address, parcels: group } of groups.values()) {
    const [first] = group;
    await tx.insert(notification).values({
      id: newId(),
      organizationId,
      createdAt: now,
      updatedAt: now,
      type: 'avis',
      personId: first!.personId,
      contactId: first!.personId ? null : first!.contactId,
      recipients: [address],
      parcelIds: group.map(({ id }) => id),
      status: 'prepared',
      channel: 'server',
      preparedAt: now,
      preparedBy: userId,
    });
  }
  return groups.size;
}
