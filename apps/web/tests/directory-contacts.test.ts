import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  contactEntries,
  mergeContact,
  mergeTarget,
  saveContact,
} from '#/features/directory/contacts';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const marc = () =>
  contactRow({
    name: 'Marc Petit',
    nameNorm: 'marc petit',
    email: 'marc.petit@prestataire.fr',
    department: 'Prestataire',
    usageCount: 2,
  });

describe('contactEntries', () => {
  it('lists the live contacts by name, with their department, e-mail or « Sans e-mail »', () => {
    const nina = contactRow({ name: 'Nina Roux', nameNorm: 'nina roux' });
    const gone = contactRow({ name: 'Ancien', deletedAt: NOW });

    expect(
      contactEntries([nina, marc(), gone]).map((e) => [e.name, e.detail]),
    ).toEqual([
      ['Marc Petit', 'Prestataire'],
      ['Nina Roux', 'Sans e-mail'],
    ]);
    expect(contactEntries([nina, marc()], 'presta')).toHaveLength(1);
  });
});

describe('mergeTarget', () => {
  it('finds the directory card of the same e-mail, or of the same name for a contact without one', () => {
    const card = personRow({
      firstName: 'Marc',
      lastName: 'Petit',
      nameNorm: 'marc petit',
      email: 'Marc.Petit@prestataire.fr',
    });
    const homonym = personRow({
      firstName: 'Marc',
      lastName: 'Petit',
      nameNorm: 'marc petit',
      email: 'marc.petit@studio.fr',
    });

    expect(mergeTarget(marc(), [card])?.id).toBe(card.id);
    expect(
      mergeTarget({ email: null, nameNorm: 'marc petit' }, [card])?.id,
    ).toBe(card.id);
    expect(
      mergeTarget({ email: null, nameNorm: 'marc petit' }, [card, homonym]),
    ).toBeNull();
  });
});

describe('saveContact', () => {
  it('refuses the e-mail of another contact, keeps one a directory card holds', async () => {
    const temp = contactRow({ name: 'Nina Roux', nameNorm: 'nina roux' });
    const other = marc();
    await db.contact.bulkPut([temp, other]);
    await db.directoryPerson.put(personRow());
    const draft = { name: 'Nina Roux', email: '', department: '' };

    expect(
      await saveContact(db, temp.id, {
        ...draft,
        email: 'MARC.PETIT@prestataire.fr',
      }),
    ).toMatchObject({ kind: 'duplicate', contact: { id: other.id } });
    expect(
      await saveContact(db, temp.id, { ...draft, email: 'nina@' }),
    ).toEqual({ kind: 'invalid', field: 'email' });
    expect(
      await saveContact(
        db,
        temp.id,
        { ...draft, email: ' Camille@example.com', department: 'Studio' },
        { now: NOW },
      ),
    ).toMatchObject({ kind: 'saved' });
    expect(await db.contact.get(temp.id)).toMatchObject({
      email: 'camille@example.com',
      department: 'Studio',
    });
  });
});

describe('mergeContact', () => {
  it('moves the parcels and learned names to the card, retires the contact, and writes nothing the second time', async () => {
    const temp = marc();
    const card = personRow({ email: 'marc.petit@prestataire.fr' });
    const parcel = parcelRow({
      personId: null,
      contactId: temp.id,
      department: 'Prestataire',
      status: 'notifie',
    });
    const alias = {
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      nameNorm: 'm petit',
      personId: null,
      contactId: temp.id,
      confirmations: 2,
    };
    await db.contact.put(temp);
    await db.directoryPerson.put(card);
    await db.parcel.put(parcel);
    await db.recipientAlias.put(alias);
    const options = { agentId: 'agent-1', now: NOW };

    expect(await mergeContact(db, temp.id, card.id, options)).toBe(1);

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      personId: card.id,
      contactId: null,
      department: 'Prestataire',
      status: 'notifie',
    });
    expect(await db.recipientAlias.get(alias.id)).toMatchObject({
      personId: card.id,
      contactId: null,
      confirmations: 2,
    });
    expect((await db.contact.get(temp.id))?.deletedAt).toEqual(NOW);
    const events = await db.event.toArray();
    expect(events.map((row) => readParcelEvent(row.type, row.detail))).toEqual([
      { type: 'parcel.edited', fields: ['recipient'] },
    ]);
    const queued = await db.outbox.count();

    expect(await mergeContact(db, temp.id, card.id, options)).toBe(0);
    expect(await db.outbox.count()).toBe(queued);
  });
});
