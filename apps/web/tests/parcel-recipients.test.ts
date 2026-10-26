import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { describe, expect, it } from 'vitest';
import {
  loadRecipientBook,
  pickRecipients,
} from '#/features/parcels/recipients';
import { checkTracking } from '#/features/parcels/tracking-check';
import {
  contactRow,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

const camille = personRow({ id: 'p-1' });
const lea = personRow({
  id: 'p-2',
  firstName: 'Léa',
  lastName: 'Fontaine',
  nameNorm: 'lea fontaine',
  email: 'lea.fontaine@example.com',
  department: 'Presse',
});
const gone = personRow({ id: 'p-3', firstName: 'Ancien', active: false });
const paul = contactRow({
  id: 'c-1',
  name: 'Paul Intérim',
  nameNorm: 'paul interim',
});
const book = {
  people: [camille, lea, gone].filter((person) => person.active),
  contacts: [paul],
  recent: ['c-1', 'p-1', 'p-9'],
};

describe('pickRecipients', () => {
  it('finds people and contacts by name, department or e-mail, accents aside', () => {
    const names = (query: string) =>
      pickRecipients(book, query).results.map((option) => option.name);
    expect(names('lea')).toEqual(['Léa Fontaine']);
    expect(names('presse')).toEqual(['Léa Fontaine']);
    expect(names('interim')).toEqual(['Paul Intérim']);
    expect(names('fontaine@')).toEqual(['Léa Fontaine']);
  });

  it('shows the latest recipients before any search', () => {
    const { results, recents } = pickRecipients(book, '');
    expect(results).toEqual([]);
    expect(recents.map((option) => option.choice)).toEqual([
      { kind: 'contact', id: 'c-1' },
      { kind: 'person', id: 'p-1' },
    ]);
  });
});

describe('checkTracking', () => {
  it('says the key of the carrier picked is right', () => {
    expect(checkTracking('1Z E63 44W 04 9923 0622', 'UPS', t).check).toEqual({
      tone: 'green',
      text: 'Clé de contrôle UPS valide',
    });
  });

  it('says it is wrong, and keeps quiet on an empty field', () => {
    expect(checkTracking('1ZE6344W0499230623', 'UPS', t).check?.tone).toBe(
      'red',
    );
    expect(checkTracking('  ', 'UPS', t)).toEqual({});
  });

  it('offers the carrier a number names when none is picked', () => {
    expect(checkTracking('1ZE6344W0499230622', '', t).carrier).toBe('UPS');
  });

  it('warns when the number is not one of the carrier picked', () => {
    expect(checkTracking('1ZE6344W0499230622', 'FedEx', t).check?.tone).toBe(
      'orange',
    );
  });
});

describe('loadRecipientBook', () => {
  it('lists the latest recipients first, the departed and deleted aside', async () => {
    const db = await openTestDatabase();
    await db.directoryPerson.bulkPut([camille, gone]);
    await db.contact.put(paul);
    await db.parcel.bulkPut([
      parcelRow({ id: newId(), personId: camille.id }),
      parcelRow({ id: newId(), contactId: paul.id }),
      parcelRow({ id: newId(), personId: gone.id, deletedAt: new Date() }),
    ]);

    const loaded = await loadRecipientBook(db);

    expect(loaded.recent).toEqual([paul.id, camille.id]);
    expect(loaded.people.map((person) => person.id)).toEqual([camille.id]);
  });
});
