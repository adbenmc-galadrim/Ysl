import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { assignRecipient } from '#/features/parcels/complete';
import {
  outsideDuplicates,
  saveOutsideContact,
} from '#/features/recipient/contacts';
import { searchOptions } from '#/features/recipient/options';
import {
  contactRow,
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

describe('searchOptions', () => {
  const hugo = personRow({
    firstName: 'Hugo',
    lastName: 'Lefèvre',
    nameNorm: 'hugo lefevre',
    email: 'hugo.lefevre@example.com',
  });
  const temp = contactRow({ name: 'Marc Petit', email: 'marc@interim.fr' });

  it('finds a name typed without its accents, and its accents typed', () => {
    expect(searchOptions([hugo], [], 'lefevre').map((o) => o.id)).toEqual([
      hugo.id,
    ]);
    expect(searchOptions([hugo], [], 'LEFÈV').map((o) => o.id)).toEqual([
      hugo.id,
    ]);
  });

  it('puts a contact who comes back first, and says it is outside the directory', () => {
    const louis = personRow({
      firstName: 'Louis',
      lastName: 'Petit',
      nameNorm: 'louis petit',
    });
    const once = contactRow({ name: 'Anne Petit', nameNorm: 'anne petit' });
    const back = contactRow({
      name: 'Zoé Petit',
      nameNorm: 'zoe petit',
      department: 'Studio',
      usageCount: 3,
      lastUsedAt: NOW,
    });

    const found = searchOptions([louis], [once, back], 'petit');

    expect(found.map((o) => [o.name, o.detail])).toEqual([
      ['Zoé Petit', 'Hors annuaire, Studio'],
      ['Anne Petit', 'Hors annuaire'],
      ['Louis Petit', louis.department ?? louis.email],
    ]);
  });

  it('finds a contact by its e-mail as well as its name', () => {
    expect(searchOptions([], [temp], 'interim').map((o) => o.id)).toEqual([
      temp.id,
    ]);
    expect(searchOptions([], [temp], 'petit').map((o) => o.id)).toEqual([
      temp.id,
    ]);
  });
});

describe('Personne hors annuaire', () => {
  it('keeps one contact per e-mail, whatever the name typed, with its last department', async () => {
    const first = await saveOutsideContact(
      db,
      { name: 'Marc Petit', email: 'Marc@Interim.fr ', department: '' },
      options,
    );
    const again = await saveOutsideContact(
      db,
      { name: 'M. Petit', email: 'marc@interim.fr', department: 'Intérim' },
      options,
    );

    expect(again.id).toBe(first.id);
    expect(await db.contact.toArray()).toMatchObject([
      {
        name: 'Marc Petit',
        email: 'marc@interim.fr',
        department: 'Intérim',
        usageCount: 2,
      },
    ]);
    const ops = await db.outbox.toArray();
    expect(new Set(ops.map((op) => `${op.entity}:${op.entityId}`))).toEqual(
      new Set([`contact:${first.id}`]),
    );
  });

  it('takes the directory card an e-mail already belongs to', async () => {
    const camille = personRow();
    await db.directoryPerson.put(camille);

    const chosen = await saveOutsideContact(
      db,
      { name: 'Camille', email: 'camille@example.com', department: '' },
      options,
    );

    expect(chosen).toMatchObject({ kind: 'person', id: camille.id });
    expect(await db.contact.count()).toBe(0);
  });

  it('names the duplicate the sheet offers instead', () => {
    const camille = personRow();
    const temp = contactRow({ name: 'Marc Petit', email: 'marc@interim.fr' });
    expect(
      outsideDuplicates(' CAMILLE@example.com', [camille], [temp]),
    ).toMatchObject([{ kind: 'person', id: camille.id }]);
    expect(
      outsideDuplicates('marc@interim.fr', [camille], [temp]),
    ).toMatchObject([{ kind: 'contact', id: temp.id }]);
    expect(outsideDuplicates('', [camille], [temp])).toEqual([]);
  });

  it('offers every twin at the address, each with its department', () => {
    const twin = (id: string, departmentId: string) =>
      personRow({
        id,
        email: 'anne@example.com',
        departmentId,
        department: null,
      });

    expect(
      outsideDuplicates(
        'anne@example.com',
        [twin('a', 'finance'), twin('b', 'presse')],
        [],
        new Map([
          ['finance', 'Finance'],
          ['presse', 'Presse'],
        ]),
      ).map((choice) => [choice.id, choice.detail]),
    ).toEqual([
      ['a', 'Finance'],
      ['b', 'Presse'],
    ]);
  });
});

describe('assignRecipient', () => {
  it('moves a parcel « À compléter » to « Reçu » once someone is chosen', async () => {
    const camille = personRow();
    const parcel = parcelRow({ status: 'a_completer', readName: 'C. MOREL' });
    await db.directoryPerson.put(camille);
    await db.parcel.put(parcel);

    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: camille.id },
      options,
    );

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'recu',
      personId: camille.id,
    });
    const events = await db.event
      .where('[entity+entityId]')
      .equals(['parcel', parcel.id])
      .toArray();
    expect(events.map((row) => readParcelEvent(row.type, row.detail))).toEqual(
      expect.arrayContaining([
        { type: 'parcel.status', from: 'a_completer', to: 'recu' },
      ]),
    );
  });

  it('keeps « À compléter » when the number is still missing', async () => {
    const camille = personRow();
    const parcel = parcelRow({
      status: 'a_completer',
      tracking: null,
      trackingNorm: null,
      carrier: null,
    });
    await db.directoryPerson.put(camille);
    await db.parcel.put(parcel);

    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: camille.id },
      options,
    );

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'a_completer',
      personId: camille.id,
    });
    const events = await db.event
      .where('[entity+entityId]')
      .equals(['parcel', parcel.id])
      .toArray();
    expect(events.map((row) => row.type)).not.toContain('parcel.status');
  });

  it('leaves a number in doubt « À compléter » when only the name showed', async () => {
    const camille = personRow();
    const doubted = parcelRow({ status: 'a_completer' });
    const read = parcelRow({ status: 'a_completer' });
    await db.directoryPerson.put(camille);
    await db.parcel.bulkPut([doubted, read]);
    await db.extraction.put({
      parcelId: read.id,
      version: 1,
      fields: {
        tracking: {
          value: read.tracking,
          confidence: 0.98,
          level: 'sure',
          flags: [],
          sources: [],
        },
      },
      codes: [],
      ocrText: null,
      durations: { codesMs: null, ocrMs: null },
      provenance: 'device',
      createdAt: NOW,
    });
    const fromList = { ...options, seesTracking: false };

    for (const parcel of [doubted, read]) {
      await assignRecipient(
        db,
        parcel.id,
        { kind: 'person', id: camille.id },
        fromList,
      );
    }

    expect(await db.parcel.get(doubted.id)).toMatchObject({
      status: 'a_completer',
      personId: camille.id,
    });
    expect(await db.parcel.get(read.id)).toMatchObject({ status: 'recu' });
  });

  it('takes the typed department away with the recipient it came with', async () => {
    const camille = personRow();
    const parcel = parcelRow({ status: 'a_completer' });
    await db.directoryPerson.put(camille);
    await db.parcel.put(parcel);
    const typed = {
      kind: 'typed' as const,
      name: 'Marc Petit',
      email: '',
      department: 'Intérim',
    };

    await assignRecipient(db, parcel.id, typed, options);
    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: camille.id },
      options,
    );

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      personId: camille.id,
      department: null,
    });
  });

  it('keeps the department typed with someone outside the directory', async () => {
    const parcel = parcelRow({ status: 'a_completer' });
    await db.parcel.put(parcel);

    await assignRecipient(
      db,
      parcel.id,
      {
        kind: 'typed',
        name: 'Marc Petit',
        email: '',
        department: 'Intérim',
      },
      options,
    );

    const saved = await db.parcel.get(parcel.id);
    expect(saved).toMatchObject({ status: 'recu', department: 'Intérim' });
    expect(saved?.contactId).toBe((await db.contact.toArray())[0]?.id);
  });
});

describe('searchOptions with departments (ME23)', () => {
  const twin = (id: string, departmentId: string | null) =>
    personRow({
      id,
      firstName: 'Anne',
      lastName: 'Martin',
      nameNorm: 'anne martin',
      email: 'anne@example.com',
      department: null,
      departmentId,
    });
  const names = new Map([
    ['finance', 'Finance'],
    ['presse', 'Presse'],
  ]);

  it('tells twins apart by their department, and finds them by its name', () => {
    const people = [twin('a', 'finance'), twin('b', 'presse')];

    expect(
      searchOptions(people, [], 'martin', names).map((o) => o.detail),
    ).toEqual(['Finance', 'Presse']);
    expect(searchOptions(people, [], 'presse', names).map((o) => o.id)).toEqual(
      ['b'],
    );
  });

  it('falls back on the word a card came with, on a row pulled before the conversion', () => {
    const before = { ...twin('a', null), department: 'Studio' };

    expect(searchOptions([before], [], 'studio', names)[0]?.detail).toBe(
      'Studio',
    );
  });

  it('falls back on the address for a card without department', () => {
    expect(
      searchOptions([twin('a', null)], [], 'martin', names)[0]?.detail,
    ).toBe('anne@example.com');
  });
});
