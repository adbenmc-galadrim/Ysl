import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { directoryEntries, savePerson } from '#/features/directory/people';
import { NOW, openTestDatabase, personRow } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const draft = {
  firstName: ' Inès ',
  lastName: 'Garnier',
  email: ' Ines.Garnier@Example.com ',
  department: '',
};

describe('savePerson', () => {
  it('adds the person and queues it, e-mail and name normalized', async () => {
    const result = await savePerson(db, draft, { now: NOW });

    expect(result.kind).toBe('saved');
    const [stored] = await db.directoryPerson.toArray();
    expect(stored).toMatchObject({
      firstName: 'Inès',
      lastName: 'Garnier',
      nameNorm: 'ines garnier',
      email: 'ines.garnier@example.com',
      department: null,
      source: 'manuel',
      active: true,
    });
    const ops = await db.outbox.toArray();
    expect(ops).toMatchObject([
      { entity: 'directory_person', entityId: stored?.id, type: 'upsert' },
    ]);
  });

  it('hands back the person already there for the same e-mail, whatever its case', async () => {
    const camille = personRow({ email: 'camille@example.com' });
    await db.directoryPerson.put(camille);

    const result = await savePerson(db, {
      ...draft,
      email: 'Camille@Example.COM',
    });

    expect(result).toMatchObject({
      kind: 'duplicate',
      person: { id: camille.id },
    });
    expect(await db.directoryPerson.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('updates a card without taking its own e-mail for a duplicate', async () => {
    const camille = personRow({ email: 'camille@example.com' });
    await db.directoryPerson.put(camille);

    const result = await savePerson(
      db,
      {
        firstName: 'Camille',
        lastName: 'Morel-Petit',
        email: 'camille@example.com',
        department: 'Presse',
      },
      { id: camille.id, now: NOW },
    );

    expect(result.kind).toBe('saved');
    expect(await db.directoryPerson.get(camille.id)).toMatchObject({
      lastName: 'Morel-Petit',
      department: 'Presse',
      createdAt: camille.createdAt,
    });
  });

  it('refuses a card without a name or with an unfinished e-mail', async () => {
    const result = await savePerson(db, {
      ...draft,
      lastName: ' ',
      email: 'ines@',
    });

    expect(result).toEqual({
      kind: 'invalid',
      errors: {
        lastName: 'Indiquez le nom.',
        email: 'Adresse e-mail incomplète.',
      },
    });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('directoryEntries', () => {
  const people = [
    personRow({
      firstName: 'Hélène',
      lastName: 'Dubois',
      department: 'Finance',
    }),
    personRow({
      firstName: 'Axelle',
      lastName: 'Bernard',
      department: null,
      email: 'axelle@example.com',
    }),
    personRow({ firstName: 'Hugo', lastName: 'Lefèvre', department: 'Studio' }),
    personRow({ firstName: 'Paul', lastName: 'Parti', active: false }),
    personRow({ firstName: 'Zoé', lastName: 'Effacée', deletedAt: NOW }),
  ];

  it('lists active people in alphabetical order, accents aside', () => {
    expect(directoryEntries(people).map((entry) => entry.name)).toEqual([
      'Axelle Bernard',
      'Hélène Dubois',
      'Hugo Lefèvre',
    ]);
  });

  it('searches the name, the department and the e-mail without accents or case', () => {
    const names = (query: string) =>
      directoryEntries(people, query).map((entry) => entry.name);

    expect(names('helene')).toEqual(['Hélène Dubois']);
    expect(names('STUDIO')).toEqual(['Hugo Lefèvre']);
    expect(names('axelle@')).toEqual(['Axelle Bernard']);
  });

  it('falls back on the e-mail when the department is unknown', () => {
    expect(directoryEntries(people, 'axelle')[0]).toMatchObject({
      initials: 'AB',
      detail: 'axelle@example.com',
    });
  });
});
