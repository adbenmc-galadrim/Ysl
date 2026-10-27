import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { assignRecipient } from '#/features/parcels/complete';
import {
  outsideDuplicate,
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
  it('keeps one contact per e-mail, whatever the name typed', async () => {
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
      { name: 'Marc Petit', email: 'marc@interim.fr', usageCount: 2 },
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
      outsideDuplicate(' CAMILLE@example.com', [camille], [temp]),
    ).toMatchObject({ kind: 'person', id: camille.id });
    expect(
      outsideDuplicate('marc@interim.fr', [camille], [temp]),
    ).toMatchObject({ kind: 'contact', id: temp.id });
    expect(outsideDuplicate('', [camille], [temp])).toBeNull();
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
