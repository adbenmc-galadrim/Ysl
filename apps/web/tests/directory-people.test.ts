import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  directoryEntries,
  directoryPeople,
  draftFromQuery,
  letterOf,
  moveEffectLines,
  openParcelsByPerson,
  sameAddressElsewhere,
  savePerson,
  toDraft,
} from '#/features/directory/people';
import { NOW, openTestDatabase, personRow } from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const draft = {
  name: ' Inès  Garnier ',
  email: ' Ines.Garnier@Example.com ',
  site: ' 2e étage ',
  departmentId: '',
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
      departmentId: null,
      site: '2e étage',
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
        name: 'Camille Morel-Petit',
        email: 'camille@example.com',
        site: 'poste 214',
        departmentId: '',
      },
      { id: camille.id, now: NOW },
    );

    expect(result.kind).toBe('saved');
    expect(await db.directoryPerson.get(camille.id)).toMatchObject({
      lastName: 'Morel-Petit',
      site: 'poste 214',
      createdAt: camille.createdAt,
    });
  });

  it('brings an inactive card back to the list when it is saved again', async () => {
    const parti = personRow({ active: false });
    await db.directoryPerson.put(parti);

    await savePerson(db, toDraft(parti), { id: parti.id, now: NOW });

    expect((await db.directoryPerson.get(parti.id))?.active).toBe(true);
  });

  it('refuses a card without a name or with an unfinished e-mail', async () => {
    const result = await savePerson(db, {
      ...draft,
      name: 'Inès',
      email: 'ines@',
    });

    expect(result).toEqual({
      kind: 'invalid',
      errors: {
        name: 'Indiquez le prénom et le nom.',
        email: 'Adresse e-mail incomplète.',
      },
    });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('a department on the card', () => {
  it('takes the one chosen on a new card, with its name', async () => {
    const id = newId();
    await db.department.put({
      id,
      name: 'Finance',
      receptionPoint: null,
      pickup: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    await savePerson(db, { ...draft, departmentId: id }, { now: NOW });

    const [stored] = await db.directoryPerson.toArray();
    expect(stored).toMatchObject({ departmentId: id, department: 'Finance' });
  });

  it('never moves an existing card: only the server does', async () => {
    const camille = personRow({ departmentId: 'finance' });
    await db.directoryPerson.put(camille);

    await savePerson(
      db,
      { ...toDraft(camille), departmentId: 'studio' },
      { id: camille.id, now: NOW },
    );

    expect((await db.directoryPerson.get(camille.id))?.departmentId).toBe(
      'finance',
    );
  });

  it('keeps a compound name as written when the name is not touched', async () => {
    const jean = personRow({ firstName: 'Jean Pierre', lastName: 'Dupont' });
    await db.directoryPerson.put(jean);

    await savePerson(db, toDraft(jean), { id: jean.id, now: NOW });

    expect(await db.directoryPerson.get(jean.id)).toMatchObject({
      firstName: 'Jean Pierre',
      lastName: 'Dupont',
    });
  });
});

describe('directoryPeople', () => {
  it('narrows by tab and finds a department by its name', () => {
    const names = new Map([['f', 'Finance']]);
    const nora = personRow({
      departmentId: 'f',
      department: null,
      nameNorm: 'nora',
    });
    const ines = personRow({
      departmentId: null,
      department: null,
      nameNorm: 'ines',
    });

    expect(directoryPeople([nora, ines], names, '', 'f')).toEqual([nora]);
    expect(directoryPeople([nora, ines], names, '', 'sans')).toEqual([ines]);
    expect(directoryPeople([nora, ines], names, 'financ')).toEqual([nora]);
  });
});

describe('letterOf', () => {
  it('files a name under its bare initial, the rest under #', () => {
    expect(letterOf('Élodie')).toBe('E');
    expect(letterOf('1 rue')).toBe('#');
  });
});

describe('moveEffectLines', () => {
  it('says what follows, what is to settle, and when nothing changes', () => {
    expect(
      moveEffectLines({ follows: 2, toSettle: 1 }, 'Finance', 'Studio').map(
        (line) => line.text,
      ),
    ).toEqual([
      '2 colis à venir iront à Finance',
      '1 colis déposé à Studio passera « À régulariser »',
    ]);
    expect(
      moveEffectLines({ follows: 0, toSettle: 0 }, 'Finance', 'Studio')[0]
        ?.text,
    ).toBe('Aucun colis en cours');
  });
});

describe('openParcelsByPerson', () => {
  it('counts the parcels still at the desk', () => {
    expect(
      openParcelsByPerson([
        { personId: 'a', status: 'recu', deletedAt: null },
        { personId: 'a', status: 'notifie', deletedAt: null },
        { personId: 'a', status: 'remis', deletedAt: null },
        { personId: 'b', status: 'recu', deletedAt: NOW },
        { personId: null, status: 'recu', deletedAt: null },
      ]).get('a'),
    ).toBe(2);
  });
});

describe('draftFromQuery', () => {
  it('puts an e-mail in the e-mail field, a name in the name fields', () => {
    expect(draftFromQuery(' ines@atelier.test ')).toEqual({
      email: 'ines@atelier.test',
    });
    expect(draftFromQuery('Garnier')).toEqual({ name: 'Garnier' });
    expect(draftFromQuery('Inès  de la Tour')).toEqual({
      name: 'Inès  de la Tour',
    });
    expect(draftFromQuery('  ')).toEqual({});
  });
});

describe('directoryEntries', () => {
  const people = [
    personRow({
      firstName: 'Hélène',
      nameNorm: 'helene dubois',
      lastName: 'Dubois',
      department: 'Finance',
    }),
    personRow({
      firstName: 'Axelle',
      nameNorm: 'axelle bernard',
      lastName: 'Bernard',
      department: null,
      email: 'axelle@atelier.test',
    }),
    personRow({
      firstName: 'Hugo',
      nameNorm: 'hugo lefevre',
      lastName: 'Lefèvre',
      department: 'Studio',
    }),
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
    expect(names('atelier.test')).toEqual(['Axelle Bernard']);
  });

  it('falls back on the e-mail when the department is unknown', () => {
    expect(directoryEntries(people, 'axelle')[0]).toMatchObject({
      initials: 'AB',
      detail: 'axelle@atelier.test',
    });
  });
});

describe('an address two departments hold', () => {
  const twin = (id: string, departmentId: string) => ({
    ...personRow({ id, email: 'hugo@example.com' }),
    departmentId,
  });

  it('leaves both cards editable as long as the address stays', async () => {
    await db.directoryPerson.bulkPut([twin('a', 'finance'), twin('b', 'studio')]);

    const result = await savePerson(
      db,
      { name: 'Hugo Lefèvre', email: 'HUGO@example.com', site: '', departmentId: '' },
      { id: 'a', now: NOW },
    );

    expect(result.kind).toBe('saved');
  });

  it('still refuses to take the address of a card this account sees', async () => {
    await db.directoryPerson.bulkPut([
      twin('a', 'finance'),
      { ...twin('b', 'studio'), email: 'autre@example.com' },
    ]);

    const result = await savePerson(
      db,
      { name: 'Autre Personne', email: 'hugo@example.com', site: '', departmentId: '' },
      { id: 'b', now: NOW },
    );

    expect(result.kind).toBe('duplicate');
  });

  it('names the other departments for the admin', () => {
    const people = [twin('a', 'finance'), twin('b', 'studio')];
    const names = new Map([['finance', 'Finance'], ['studio', 'Studio']]);

    expect(sameAddressElsewhere(people[0]!, people, names)).toEqual(['Studio']);
  });
});
