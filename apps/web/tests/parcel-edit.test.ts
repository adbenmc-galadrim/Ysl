import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  editOf,
  validateEdit,
  type ParcelEdit,
  parseWeight,
  saveParcelEdit,
} from '#/features/parcels/edit';
import { deleteParcel, deleteParcels } from '#/features/parcels/status';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const options = { agentId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function events(parcelId: string) {
  const rows = await db.event
    .where('[entity+entityId]')
    .equals(['parcel', parcelId])
    .toArray();
  return rows.map((row) => readParcelEvent(row.type, row.detail));
}

describe('saveParcelEdit', () => {
  it('writes the parcel, its op and the history event in one go', async () => {
    const row = parcelRow({ weightKg: null, notes: null });
    await db.parcel.put(row);
    const edit: ParcelEdit = {
      ...editOf(row),
      weightKg: '2,4',
      notes: ' Fragile ',
    };

    const result = await saveParcelEdit(db, row.id, edit, options);

    expect(result).toEqual({ kind: 'saved', fields: ['notes', 'weightKg'] });
    expect(await db.parcel.get(row.id)).toMatchObject({
      weightKg: 2.4,
      notes: 'Fragile',
      status: 'recu',
      updatedAt: NOW,
    });
    const ops = await db.outbox.toArray();
    expect(ops.map((op) => [op.entity, op.entityId])).toEqual([
      ['parcel', row.id],
      ['event', expect.any(String)],
    ]);
    expect(await events(row.id)).toEqual([
      { type: 'parcel.edited', fields: ['notes', 'weightKg'] },
    ]);
  });

  it('writes nothing when nothing changed', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    expect(await saveParcelEdit(db, row.id, editOf(row), options)).toEqual({
      kind: 'unchanged',
    });
    expect(await db.outbox.count()).toBe(0);
  });

  it('moves a parcel to complete to "À notifier" once someone is chosen', async () => {
    const person = personRow();
    await db.directoryPerson.put(person);
    const row = parcelRow({ status: 'a_completer', statusSeq: 1 });
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), recipient: { kind: 'person', id: person.id } },
      options,
    );

    expect(await db.parcel.get(row.id)).toMatchObject({
      personId: person.id,
      status: 'recu',
      statusSeq: 2,
    });
    expect(await events(row.id)).toContainEqual({
      type: 'parcel.status',
      from: 'a_completer',
      to: 'recu',
    });
  });

  it('keeps a parcel to complete when the agent only adds a note (F26)', async () => {
    const row = parcelRow({
      status: 'a_completer',
      carrier: 'DHL Express',
      tracking: '5413337112',
      readName: 'C. MOREL',
    });
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), notes: 'Carton abîmé' },
      options,
    );

    expect(await db.parcel.get(row.id)).toMatchObject({
      notes: 'Carton abîmé',
      status: 'a_completer',
    });
  });

  it('moves a parcel received on a name read alone back when its carrier goes', async () => {
    const row = parcelRow({ status: 'recu', readName: 'C. MOREL' });
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), notes: 'Fragile' },
      options,
    );
    expect(await db.parcel.get(row.id)).toMatchObject({ status: 'recu' });

    await saveParcelEdit(db, row.id, { ...editOf(row), carrier: '' }, options);
    expect(await db.parcel.get(row.id)).toMatchObject({
      status: 'a_completer',
    });
  });

  it('keeps the app’s number of a parcel « Sans suivi » out of the form', async () => {
    const row = parcelRow({
      type: 'sans_suivi',
      carrier: null,
      tracking: 'INT7K2Q9MXA',
      trackingNorm: 'INT7K2Q9MXA',
      personId: 'p-1',
    });
    await db.parcel.put(row);
    expect(editOf(row).tracking).toBe('');

    await saveParcelEdit(db, row.id, { ...editOf(row), notes: 'Pli' }, options);
    expect(await db.parcel.get(row.id)).toMatchObject({
      type: 'sans_suivi',
      tracking: 'INT7K2Q9MXA',
    });

    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), tracking: '1ZE6344W0499230622', carrier: 'UPS' },
      options,
    );
    expect(await db.parcel.get(row.id)).toMatchObject({
      type: 'colis',
      tracking: '1ZE6344W0499230622',
      carrier: 'UPS',
    });
  });

  it('moves a parcel back to complete when its carrier goes', async () => {
    const row = parcelRow({ status: 'recu', personId: 'p-1' });
    await db.parcel.put(row);

    await saveParcelEdit(db, row.id, { ...editOf(row), carrier: '' }, options);

    expect(await db.parcel.get(row.id)).toMatchObject({
      carrier: null,
      status: 'a_completer',
      statusSeq: 1,
    });
  });

  it('keeps a recipient on a notified parcel', async () => {
    const row = parcelRow({
      status: 'notifie',
      personId: 'p-1',
      notifiedAt: NOW,
    });
    await db.parcel.put(row);

    const result = await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), recipient: { kind: 'none' } },
      options,
    );

    expect(result).toEqual({
      kind: 'invalid',
      errors: { recipient: 'recipientRequired' },
    });
    expect(await db.outbox.count()).toBe(0);
  });

  it('keeps a recipient on a returned parcel that was notified', async () => {
    const row = parcelRow({
      status: 'retourne',
      contactId: 'c-1',
      notifiedAt: NOW,
    });
    await db.parcel.put(row);

    const result = await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), recipient: { kind: 'none' } },
      options,
    );

    expect(result).toEqual({
      kind: 'invalid',
      errors: { recipient: 'recipientRequired' },
    });
  });

  it('says a typed e-mail is wrong under the recipient', async () => {
    const row = parcelRow({ status: 'a_completer' });
    await db.parcel.put(row);

    const result = await saveParcelEdit(
      db,
      row.id,
      {
        ...editOf(row),
        recipient: { kind: 'typed', name: 'Paul', email: 'paul@' },
      },
      options,
    );

    expect(result).toEqual({
      kind: 'invalid',
      errors: { recipient: 'emailInvalid' },
    });
  });

  it('turns a name typed by hand into a contact', async () => {
    const row = parcelRow({ status: 'a_completer' });
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      {
        ...editOf(row),
        recipient: {
          kind: 'typed',
          name: 'Paul Intérim',
          email: 'Paul@Example.com',
        },
      },
      options,
    );

    const parcel = await db.parcel.get(row.id);
    const contact = await db.contact.get(parcel?.contactId ?? '');
    expect(contact).toMatchObject({
      name: 'Paul Intérim',
      nameNorm: 'paul interim',
      email: 'paul@example.com',
    });
    expect(parcel).toMatchObject({ personId: null, status: 'recu' });
  });

  it('keeps one contact for a name typed twice', async () => {
    const first = parcelRow({ status: 'a_completer' });
    const second = parcelRow({ status: 'a_completer' });
    await db.parcel.bulkPut([first, second]);
    const typed = (email: string) => ({
      kind: 'typed' as const,
      name: 'Paul Intérim',
      email,
    });

    await saveParcelEdit(
      db,
      first.id,
      { ...editOf(first), recipient: typed('') },
      options,
    );
    await saveParcelEdit(
      db,
      second.id,
      { ...editOf(second), recipient: typed('paul@example.com') },
      options,
    );

    const contacts = await db.contact.toArray();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      email: 'paul@example.com',
      usageCount: 2,
    });
    expect((await db.parcel.get(second.id))?.contactId).toBe(contacts[0]?.id);
  });

  it('refuses a weight, an e-mail or pieces it cannot keep', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    const result = await saveParcelEdit(
      db,
      row.id,
      {
        ...editOf(row),
        weightKg: 'deux',
        notificationEmail: 'camille@',
        pieceTotal: 2,
        pieceN: 3,
      },
      options,
    );

    expect(result).toEqual({
      kind: 'invalid',
      errors: {
        weight: 'weightInvalid',
        email: 'emailInvalid',
        pieces: 'piecesInvalid',
      },
    });
  });

  it('normalizes the tracking number and learns a sender renamed', async () => {
    const row = parcelRow({ senderId: 's-1', senderName: 'Metalworks' });
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      {
        ...editOf(row),
        tracking: '1z e63 44w 04 9923 0623',
        sender: 'Zalando',
      },
      options,
    );

    expect(await db.parcel.get(row.id)).toMatchObject({
      tracking: '1ZE6344W0499230623',
      trackingNorm: '1ZE6344W0499230623',
      senderName: 'Zalando',
      senderId: (await db.sender.where('nameNorm').equals('zalando').first())
        ?.id,
    });
  });

  it('teaches nothing for a department, whose learning the server refuses', async () => {
    const person = personRow({ firstName: 'Léa', lastName: 'Fontaine' });
    const row = parcelRow({ senderName: 'Metalworks' });
    await db.directoryPerson.put(person);
    await db.parcel.put(row);

    await saveParcelEdit(
      db,
      row.id,
      {
        ...editOf(row),
        sender: 'Zalando',
        recipient: { kind: 'person', id: person.id },
      },
      { ...options, learns: false },
    );

    const entities = new Set(
      (await db.outbox.toArray()).map((op) => op.entity),
    );
    expect(entities).toEqual(new Set(['parcel', 'event']));
    expect(await db.parcel.get(row.id)).toMatchObject({
      senderName: 'Zalando',
      senderId: null,
      personId: person.id,
    });
  });
});

describe('parseWeight', () => {
  it('reads a comma or a point, and nothing as nothing', () => {
    expect(parseWeight('2,4')).toBe(2.4);
    expect(parseWeight(' 12.5 ')).toBe(12.5);
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('2,4 kg')).toBeUndefined();
  });
});

describe('deleteParcel', () => {
  it('deletes logically and keeps the event', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    await deleteParcel(db, row.id, options);

    expect((await db.parcel.get(row.id))?.deletedAt).toEqual(NOW);
    const ops = await db.outbox.toArray();
    expect(ops.map((op) => [op.entity, op.type])).toEqual([
      ['event', 'upsert'],
      ['parcel', 'delete'],
    ]);
    expect(await events(row.id)).toEqual([{ type: 'parcel.deleted' }]);
  });
});

describe('deleteParcels', () => {
  it('deletes the ticked parcels nobody was told about in one write, and leaves the others', async () => {
    const incomplete = parcelRow({ status: 'a_completer' });
    const received = parcelRow();
    const notified = parcelRow({ status: 'notifie', notifiedAt: NOW });
    await db.parcel.bulkPut([incomplete, received, notified]);

    const deleted = await deleteParcels(
      db,
      [incomplete.id, notified.id, received.id, 'gone'],
      options,
    );

    expect(deleted).toEqual([incomplete.id, received.id]);
    expect((await db.parcel.get(notified.id))?.deletedAt).toBeNull();
    expect((await db.parcel.get(received.id))?.deletedAt).toEqual(NOW);
    const ops = await db.outbox.toArray();
    expect(ops.map((op) => [op.entity, op.type])).toEqual([
      ['event', 'upsert'],
      ['event', 'upsert'],
      ['parcel', 'delete'],
      ['parcel', 'delete'],
    ]);
    expect(await events(incomplete.id)).toEqual([{ type: 'parcel.deleted' }]);
    expect(await deleteParcels(db, [notified.id], options)).toEqual([]);
  });
});

describe('validateEdit on tour', () => {
  const edit = { ...editOf(parcelRow()), recipient: { kind: 'none' as const } };
  const told = { notifiedAt: null, lastNotifiedAt: NOW };

  it('keeps the recipient of a parcel whose e-mail already left', () => {
    expect(validateEdit(edit, { status: 'en_route', ...told }).recipient).toBe(
      'recipientRequired',
    );
    expect(
      validateEdit(edit, { status: 'a_regulariser', ...told }).recipient,
    ).toBe('recipientRequired');
  });

  it('lets a parcel nobody was told about go without one', () => {
    expect(
      validateEdit(edit, {
        status: 'en_route',
        notifiedAt: null,
        lastNotifiedAt: null,
      }).recipient,
    ).toBeUndefined();
  });
});
