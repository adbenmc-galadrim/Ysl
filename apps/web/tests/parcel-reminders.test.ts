import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalNotification } from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';
import { loadReminderDates } from '#/features/parcels/reminders';
import { openTestDatabase, parcelRow } from './helpers/local-rows';

const day = (date: number) => new Date(2026, 9, date, 10);

function mail(
  parcelIds: string[],
  sentAt: Date | null,
  overrides: Partial<LocalNotification> = {},
): LocalNotification {
  return {
    id: newId(),
    createdAt: day(1),
    updatedAt: day(1),
    deletedAt: null,
    type: 'relance',
    personId: 'p-1',
    contactId: null,
    recipients: ['nora@example.com'],
    cc: [],
    parcelIds,
    templateId: null,
    status: sentAt ? 'sent' : 'opened',
    target: 'mailto',
    preparedAt: sentAt ?? day(1),
    preparedBy: 'agent-1',
    openedAt: null,
    sentAt,
    failedReason: null,
    ...overrides,
  };
}

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('loadReminderDates', () => {
  it('dates the reminders by the mails sent after the notice, from any agent', async () => {
    const parcel = parcelRow({
      personId: 'p-1',
      status: 'notifie',
      notifiedAt: day(16),
    });
    const other = parcelRow({ personId: 'p-1', status: 'recu' });
    await db.notification.bulkPut([
      mail([parcel.id], day(16), { type: 'avis' }),
      mail([parcel.id, other.id], day(20), { preparedBy: 'agent-2' }),
      mail([parcel.id], null),
      mail([parcel.id], day(21), { deletedAt: day(21) }),
      mail([parcel.id], day(22)),
    ]);

    const dates = await loadReminderDates(db, [parcel, other]);

    expect(dates.get(parcel.id)).toEqual([day(20), day(22)]);
    expect(dates.has(other.id)).toBe(false);
  });

  it('counts a reminder given in person, in order with the mails (F25)', async () => {
    const parcel = parcelRow({
      contactId: 'c-1',
      status: 'notifie',
      notifiedAt: day(16),
    });
    const told = (at: Date, kind: 'avis' | 'relance') =>
      parcelEvent(
        parcel.id,
        { type: 'parcel.informed', kind },
        { agentId: 'agent-1', now: at },
      ).row as never;
    await db.event.bulkPut([told(day(16), 'avis'), told(day(22), 'relance')]);
    await db.notification.put(mail([parcel.id], day(20)));

    const dates = await loadReminderDates(db, [parcel]);

    expect(dates.get(parcel.id)).toEqual([day(20), day(22)]);
  });

  it('reads nothing without a notified parcel', async () => {
    await db.notification.put(mail(['x'], day(20)));
    const dates = await loadReminderDates(db, [parcelRow({ status: 'recu' })]);
    expect(dates.size).toBe(0);
  });
});
