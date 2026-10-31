import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { pickupPinHash } from '@repo/contract/pickup';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { markSent, prepareNotification } from '#/features/mail/notifications';
import {
  informOrally,
  recordRelay,
  relayKey,
  rememberedRelay,
  type Relay,
} from '#/features/mail/notify-ways';
import { recallSecrets } from '#/features/mail/pickup-code';
import type { RecipientMail } from '#/features/mail/recipients';
import { lookupPickupPin } from '#/features/handover/pickup-lookup';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

const options = { userId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const marc = contactRow({ name: 'Marc Petit', nameNorm: 'marc petit' });
const sophie = personRow({
  firstName: 'Sophie',
  lastName: 'Martin',
  email: 'sophie.martin@example.com',
});

function mailOf(parcels: RecipientMail['parcels']): RecipientMail {
  return {
    key: `contact:${marc.id}`,
    personId: null,
    contactId: marc.id,
    name: 'Marc Petit',
    firstName: 'Marc',
    lastName: 'Marc Petit',
    address: null,
    parcels,
  };
}

const eventsOf = async (parcelId: string) =>
  (await db.event.toArray())
    .filter((row) => row.entityId === parcelId)
    .map((row) => readParcelEvent(row.type, row.detail));

describe('telling someone without an address in person', () => {
  it('notifies their received parcels, writes the code read out and its history line', async () => {
    const received = parcelRow({ contactId: marc.id, statusSeq: 1 });
    await db.contact.put(marc);
    await db.parcel.put(received);

    const result = await informOrally(
      db,
      {
        mail: mailOf([received]),
        secret: { pin: '4821', token: 'token-1' },
        reminder: false,
      },
      options,
    );

    expect(result.written).toBe(true);
    expect(await db.parcel.get(received.id)).toMatchObject({
      status: 'notifie',
      notifiedAt: NOW,
    });
    expect(await eventsOf(received.id)).toEqual([
      { type: 'parcel.informed', kind: 'avis' },
    ]);
    const [code] = await db.pickupCode.toArray();
    expect(code).toMatchObject({
      contactId: marc.id,
      personId: null,
      pinHash: await pickupPinHash('4821'),
      deletedAt: null,
    });
    const match = await lookupPickupPin(db, '4821', NOW);
    expect(match.status).toBe('active');
  });

  it('writes nothing the second time: the parcels were already told', async () => {
    const received = parcelRow({ contactId: marc.id });
    await db.parcel.put(received);
    const mail = mailOf([received]);
    await informOrally(
      db,
      { mail, secret: { pin: '4821', token: 'token-1' }, reminder: false },
      options,
    );
    const ops = await db.outbox.count();

    const again = await informOrally(
      db,
      {
        mail: { ...mail, parcels: [(await db.parcel.get(received.id))!] },
        secret: { pin: '5930', token: 'token-2' },
        reminder: false,
      },
      options,
    );

    expect(again.written).toBe(false);
    expect(await db.outbox.count()).toBe(ops);
    expect(await db.pickupCode.count()).toBe(1);
  });

  it('dates a reminder on the notified parcels and keeps the open code', async () => {
    const notified = parcelRow({
      contactId: marc.id,
      status: 'notifie',
      notifiedAt: new Date(2026, 9, 20),
    });
    await db.parcel.put(notified);
    const mail = mailOf([notified]);
    await db.pickupCode.put(
      await pickupCodeRow({ contactId: marc.id }, { pin: '4821' }),
    );
    const [secret] = await recallSecrets(db, [mail], { now: NOW });

    const result = await informOrally(
      db,
      { mail, secret: secret!, reminder: true },
      options,
    );

    expect(result.written).toBe(true);
    expect(await db.parcel.get(notified.id)).toMatchObject({
      status: 'notifie',
      notifiedAt: new Date(2026, 9, 20),
      lastNotifiedAt: NOW,
    });
    expect((await eventsOf(notified.id)).at(-1)).toEqual({
      type: 'parcel.informed',
      kind: 'relance',
    });
    expect(secret?.pin).toBe('4821');
    expect(await db.pickupCode.count()).toBe(1);
  });
});

describe('telling a contact instead', () => {
  const relay: Relay = {
    kind: 'person',
    id: sophie.id,
    name: 'Sophie Martin',
    address: 'sophie.martin@example.com',
  };

  it('records the mail to the contact for the recipient, and notifies the parcels on « yes »', async () => {
    const received = parcelRow({ contactId: marc.id, statusSeq: 1 });
    await db.parcel.put(received);

    const row = await prepareNotification(
      db,
      {
        type: 'avis',
        contactId: marc.id,
        recipients: [relay.address],
        parcelIds: [received.id],
        templateId: null,
        target: 'mailto',
        relayName: relay.name,
      },
      options,
    );
    await markSent(db, row.id, options);

    expect(await db.notification.get(row.id)).toMatchObject({
      contactId: marc.id,
      recipients: ['sophie.martin@example.com'],
      relayName: 'Sophie Martin',
      status: 'sent',
    });
    expect(await db.parcel.get(received.id)).toMatchObject({
      status: 'notifie',
    });
  });

  it('remembers who was told and expects them at the desk when ticked', async () => {
    const notified = parcelRow({
      contactId: marc.id,
      status: 'notifie',
      notifiedAt: NOW,
    });
    await db.contact.put(marc);
    await db.directoryPerson.put(sophie);
    await db.parcel.put(notified);

    await recordRelay(
      db,
      { mail: mailOf([notified]), relay, collects: true },
      { now: NOW },
    );

    expect((await db.contact.get(marc.id))?.notifyVia).toBe(relayKey(relay));
    expect((await db.parcel.get(notified.id))?.expectedDelegate).toBe(
      'Sophie Martin',
    );
    expect((await rememberedRelay(db, mailOf([])))?.id).toBe(sophie.id);
  });

  it('leaves the parcels alone when the contact will not collect them', async () => {
    const notified = parcelRow({ contactId: marc.id, status: 'notifie' });
    await db.contact.put(marc);
    await db.parcel.put(notified);

    await recordRelay(
      db,
      { mail: mailOf([notified]), relay, collects: false },
      { now: NOW },
    );

    expect((await db.parcel.get(notified.id))?.expectedDelegate).toBeNull();
  });

  it('remembers no twin: the address alone does not say which card', async () => {
    const pierre = personRow({ firstName: 'Pierre', email: '' });
    await db.directoryPerson.bulkPut([
      pierre,
      personRow({ email: 'anne@example.com', departmentId: 'a' }),
      personRow({ email: 'anne@example.com', departmentId: 'b' }),
    ]);
    await db.notification.put({
      id: '0199f000-0000-7000-8000-0000000000f3',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      type: 'avis',
      personId: pierre.id,
      contactId: null,
      recipients: ['anne@example.com'],
      cc: [],
      parcelIds: ['0199f000-0000-7000-8000-0000000000f2'],
      templateId: null,
      status: 'sent',
      target: 'mailto',
      preparedAt: NOW,
      preparedBy: 'agent-1',
      openedAt: null,
      sentAt: NOW,
      failedReason: null,
      relayName: 'Anne Martin',
    });

    expect(
      await rememberedRelay(db, { personId: pierre.id, contactId: null }),
    ).toBeNull();
  });

  it('finds the contact told last time for a card without address, from the mails', async () => {
    const pierre = personRow({
      firstName: 'Pierre',
      lastName: 'Roy',
      email: '',
    });
    await db.directoryPerson.bulkPut([pierre, sophie]);
    await db.notification.put({
      id: '0199f000-0000-7000-8000-0000000000f1',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      type: 'avis',
      personId: pierre.id,
      contactId: null,
      recipients: ['sophie.martin@example.com'],
      cc: [],
      parcelIds: ['0199f000-0000-7000-8000-0000000000f2'],
      templateId: null,
      status: 'sent',
      target: 'mailto',
      preparedAt: NOW,
      preparedBy: 'agent-1',
      openedAt: null,
      sentAt: NOW,
      failedReason: null,
      relayName: 'Sophie Martin',
    });

    const remembered = await rememberedRelay(db, {
      personId: pierre.id,
      contactId: null,
    });

    expect(remembered).toMatchObject({ kind: 'person', id: sophie.id });
  });
});
