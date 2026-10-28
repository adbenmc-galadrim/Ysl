import 'fake-indexeddb/auto';
import {
  newPickupToken,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalPickupCode } from '#/features/db/schema';
import { pickupCodeWrites, recallSecrets } from '#/features/mail/pickup-code';
import { dueCount, loadReminderMails } from '#/features/mail/reminder-mails';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

/** A day of October 2026, at 10 a.m.: NOW is Saturday the 24th. */
const day = (date: number) => new Date(2026, 9, date, 10);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function code(
  overrides: Partial<LocalPickupCode> & { pin: string },
): Promise<LocalPickupCode> {
  const { pin, ...rest } = overrides;
  const row: LocalPickupCode = {
    id: newId(),
    createdAt: day(20),
    updatedAt: day(20),
    deletedAt: null,
    personId: null,
    contactId: null,
    tokenHash: await pickupTokenHash(newPickupToken()),
    pinHash: await pickupPinHash(pin),
    expiresAt: day(30),
    usedAt: null,
    ...rest,
  };
  await db.pickupCode.put(row);
  return row;
}

describe('the code a reminder quotes', () => {
  it('finds the open PIN again from its hash, and draws one for whoever has none', async () => {
    const nora = personRow({ firstName: 'Nora' });
    const ines = personRow({ firstName: 'Inès' });
    const atelier = contactRow();
    await code({ personId: nora.id, pin: '1111', createdAt: day(16) });
    const open = await code({ personId: nora.id, pin: '4821' });
    await code({ personId: ines.id, pin: '2222', usedAt: day(21) });
    await code({ personId: ines.id, pin: '3333', expiresAt: day(23) });
    await code({ contactId: atelier.id, pin: '5555', deletedAt: day(21) });

    const [forNora, forInes, forAtelier] = await recallSecrets(
      db,
      [
        { personId: nora.id, contactId: null },
        { personId: ines.id, contactId: null },
        { personId: null, contactId: atelier.id },
      ],
      { now: NOW },
    );

    expect(forNora).toMatchObject({ pin: '4821', codeId: open.id });
    expect(forInes?.codeId).toBeUndefined();
    expect(forAtelier?.codeId).toBeUndefined();
    expect(['1111', '4821', forInes?.pin]).not.toContain(forAtelier?.pin);
    expect(forInes?.pin).toMatch(/^\d{4}$/);
    expect(forNora?.token).not.toBe(forInes?.token);
  });

  it('keeps the open code with the new QR token, the PIN unchanged', async () => {
    const nora = personRow();
    const open = await code({ personId: nora.id, pin: '4821' });
    const token = newPickupToken();

    const writes = await pickupCodeWrites(
      db,
      { personId: nora.id, contactId: null },
      { pin: '4821', token, codeId: open.id },
      { now: NOW },
    );

    expect(writes).toEqual([
      {
        entity: 'pickup_code',
        row: {
          ...open,
          updatedAt: NOW,
          tokenHash: await pickupTokenHash(token),
        },
      },
    ]);
  });
});

describe('the reminders to send', () => {
  it('groups per person the parcels due or late, the due ones first', async () => {
    const nora = personRow({ firstName: 'Nora', email: 'nora@example.com' });
    const ines = personRow({ firstName: 'Inès', email: 'ines@example.com' });
    await db.directoryPerson.bulkPut([nora, ines]);
    const due = parcelRow({
      personId: nora.id,
      status: 'notifie',
      notifiedAt: day(21),
    });
    const recent = parcelRow({
      personId: nora.id,
      status: 'notifie',
      notifiedAt: day(23),
    });
    const late = parcelRow({
      personId: ines.id,
      status: 'notifie',
      notifiedAt: day(12),
      lastNotifiedAt: day(20),
    });
    await db.parcel.bulkPut([due, recent, late]);
    await db.notification.bulkPut(
      [day(16), day(20)].map((sentAt) => ({
        id: newId(),
        createdAt: sentAt,
        updatedAt: sentAt,
        deletedAt: null,
        type: 'relance' as const,
        personId: ines.id,
        contactId: null,
        recipients: [ines.email],
        cc: [],
        parcelIds: [late.id],
        templateId: null,
        status: 'sent' as const,
        target: 'mailto' as const,
        preparedAt: sentAt,
        preparedBy: 'agent-1',
        openedAt: null,
        sentAt,
        failedReason: null,
      })),
    );

    const mails = await loadReminderMails(db, NOW);

    expect(
      mails.map((mail) => [
        mail.name,
        mail.due,
        mail.parcels.map(({ id }) => id),
      ]),
    ).toEqual([
      ['Nora Morel', true, [due.id]],
      ['Inès Morel', false, [late.id]],
    ]);
    expect(mails[1]?.reminders.get(late.id)).toMatchObject({
      sent: 2,
      late: true,
    });
    expect(dueCount(mails)).toBe(1);
  });
});
