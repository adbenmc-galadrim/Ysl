import { PARCEL_ON_MOVE } from '@repo/contract/directory';
import { PARCEL_STATUSES } from '@repo/contract/parcel-status';
import type { AnyDb } from '@repo/db';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyDirectoryImport,
  previewDirectoryImport,
} from '#features/directory/import';
import {
  closeMoveRequest,
  moveEffectsOf,
  movePerson,
  moveRequestsOf,
  requestMove,
} from '#features/directory/service';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';
import { accessOf, addDepartment, addPerson } from './helpers/departments';
import {
  asAnyDb,
  openTestDb,
  AGENT_ID,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let any: AnyDb;
let finance: string;
let studio: string;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  any = asAnyDb(db);
  finance = await addDepartment(db, 'Finance');
  studio = await addDepartment(db, 'Studio');
});

afterAll(async () => {
  await client.close();
});

async function addParcel(personId: string) {
  const row = { ...parcelRow(), personId };
  await db.insert(schema.parcel).values(row);
  return row.id;
}

async function addCode(personId: string, departmentId: string | null) {
  const id = newId();
  await db.insert(schema.pickupCode).values({
    id,
    organizationId: ORGANIZATION_ID,
    personId,
    departmentId,
    tokenHash: id,
    pinHash: id,
    expiresAt: new Date('2030-01-01T00:00:00Z'),
  });
  return id;
}

const parcelOf = async (id: string) =>
  (await db.select().from(schema.parcel).where(eq(schema.parcel.id, id)))[0]!;

const codeOf = async (id: string) =>
  (
    await db
      .select()
      .from(schema.pickupCode)
      .where(eq(schema.pickupCode.id, id))
  )[0]!;

const move = (personId: string, departmentId: string) =>
  movePerson(any, ORGANIZATION_ID, { personId, departmentId });

describe('a person who changes department', () => {
  it.each(PARCEL_STATUSES)(
    'treats a parcel in %s as the contract says',
    async (status) => {
      const person = await addPerson(db, finance);
      const parcel = await addParcel(person);
      await client.exec(
        `alter table parcel disable trigger user; update parcel set status = '${status}', delivered_at = case when '${status}' = 'remis' then now() end, delivered_by = case when '${status}' = 'remis' then received_by end where id = '${parcel}'; alter table parcel enable trigger user;`,
      );

      await move(person, studio);

      expect((await parcelOf(parcel)).departmentId).toBe(
        PARCEL_ON_MOVE[status] === 'follows' ? studio : finance,
      );
      expect((await parcelOf(parcel)).status).toBe(
        PARCEL_ON_MOVE[status] === 'toSettle' ? 'a_regulariser' : status,
      );
    },
  );

  it('marks a deposited parcel in place, one step up, with its line in the history', async () => {
    const person = await addPerson(db, finance);
    const parcel = await addParcel(person);
    await client.exec(
      `update parcel set department_id = '${finance}', status = 'en_route', status_seq = 1 where id = '${parcel}'; update parcel set status = 'depose', status_seq = 2, deposited_at = now() where id = '${parcel}';`,
    );

    expect(await moveEffectsOf(any, ORGANIZATION_ID, person)).toEqual({
      follows: 0,
      toSettle: 1,
    });
    await move(person, studio);

    expect(await parcelOf(parcel)).toMatchObject({
      status: 'a_regulariser',
      statusSeq: 3,
      departmentId: finance,
    });
    const events = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.entityId, parcel));
    expect(events).toEqual([
      expect.objectContaining({
        entity: 'parcel',
        type: 'parcel.status',
        detail: { from: 'depose', to: 'a_regulariser' },
      }),
    ]);
    const { rows } = await pull(
      any,
      {
        organizationId: ORGANIZATION_ID,
        userId: AGENT_ID,
        role: 'department',
        departmentId: finance,
      },
      {
        cursor: null,
        page: null,
        limit: 1000,
        departments: true,
      },
    );
    expect(
      rows.some(({ entity, row }) => entity === 'parcel' && row.id === parcel),
    ).toBe(true);
  });

  it('marks a parcel deposited and notified in place, and lets an earlier one follow', async () => {
    const person = await addPerson(db, finance);
    const deposited = await addParcel(person);
    const atTheDesk = await addParcel(person);
    await client.exec(
      `update parcel set status = 'notifie', status_seq = 1, notified_at = now() where id in ('${deposited}', '${atTheDesk}'); update parcel set deposited_at = now() where id = '${deposited}';`,
    );

    expect(await moveEffectsOf(any, ORGANIZATION_ID, person)).toEqual({
      follows: 1,
      toSettle: 1,
    });
    await move(person, studio);

    expect(await parcelOf(deposited)).toMatchObject({
      status: 'a_regulariser',
      departmentId: finance,
    });
    expect(await parcelOf(atTheDesk)).toMatchObject({
      status: 'notifie',
      departmentId: studio,
    });
  });

  it('says beforehand what will follow', async () => {
    const person = await addPerson(db, finance);
    await addParcel(person);
    await addParcel(person);

    expect(await moveEffectsOf(any, ORGANIZATION_ID, person)).toEqual({
      follows: 2,
      toSettle: 0,
    });
  });

  it('takes the open code along, so the new department can use it', async () => {
    const person = await addPerson(db, finance);
    const code = await addCode(person, finance);

    await move(person, studio);

    expect((await codeOf(code)).departmentId).toBe(studio);
  });

  it('leaves one open code when one already waits at the new department', async () => {
    const person = await addPerson(db, finance);
    const moved = await addCode(person, finance);
    const there = await addCode(person, studio);

    await move(person, studio);

    expect((await codeOf(moved)).deletedAt).not.toBeNull();
    expect((await codeOf(there)).deletedAt).toBeNull();
  });

  it('lets a valid code win over an expired one at the new department', async () => {
    const person = await addPerson(db, finance);
    const moved = await addCode(person, finance);
    const there = await addCode(person, studio);
    await db
      .update(schema.pickupCode)
      .set({ expiresAt: new Date('2020-01-01T00:00:00Z') })
      .where(eq(schema.pickupCode.id, there));

    await move(person, studio);

    expect((await codeOf(there)).deletedAt).not.toBeNull();
    expect(await codeOf(moved)).toMatchObject({
      deletedAt: null,
      departmentId: studio,
    });
  });

  it('brings the parcel to the new department and starts the old one over', async () => {
    const before = await pull(any, accessOf('department', finance), {
      cursor: null,
      page: null,
      limit: 500,
      departments: true,
    });
    const person = await addPerson(db, finance);
    const parcel = await addParcel(person);
    const code = await addCode(person, finance);

    await move(person, studio);

    const newDepartment = await pull(any, accessOf('department', studio), {
      cursor: null,
      page: null,
      limit: 500,
      departments: true,
    });
    expect(newDepartment.rows.map(({ row }) => row.id)).toEqual(
      expect.arrayContaining([parcel, code]),
    );
    const oldDepartment = await pull(any, accessOf('department', finance), {
      cursor: { generation: before.generation, xid: before.cursor },
      page: null,
      limit: 500,
      departments: true,
    });
    expect(oldDepartment.reset).toBe(true);
    expect(oldDepartment.rows.map(({ row }) => row.id)).not.toContain(parcel);
  });

  it('is not moved back by a stale copy of the card', async () => {
    const person = await addPerson(db, finance);
    const [card] = await db
      .select({
        id: schema.directoryPerson.id,
        lastName: schema.directoryPerson.lastName,
        firstName: schema.directoryPerson.firstName,
        nameNorm: schema.directoryPerson.nameNorm,
        email: schema.directoryPerson.email,
      })
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    await move(person, studio);

    const {
      results: [result],
    } = await push(any, accessOf('company_admin'), {
      ops: [
        {
          opId: newId(),
          entity: 'directory_person',
          entityId: person,
          type: 'upsert',
          patch: {
            ...card,
            firstName: 'Noor',
            departmentId: finance,
            department: 'Finance',
          },
          clientTs: new Date(),
        },
      ],
    } as never);
    expect(result?.status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    expect(row).toMatchObject({
      firstName: 'Noor',
      departmentId: studio,
      department: 'Studio',
    });
  });

  it('refuses a department of another company, and an archived one', async () => {
    const person = await addPerson(db, finance);
    const foreign = await addDepartment(db, 'Dehors', OTHER_ORGANIZATION_ID);
    await expect(move(person, foreign)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const gone = await addDepartment(db, 'Fermé');
    await db
      .update(schema.department)
      .set({ deletedAt: new Date() })
      .where(eq(schema.department.id, gone));
    await expect(move(person, gone)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses a person of another company', async () => {
    const stranger = await addPerson(db, null, OTHER_ORGANIZATION_ID);
    await expect(move(stranger, studio)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('the CSV import', () => {
  const FILE = [
    'nom;prenom;mail;service;bureau',
    'Mercier;Paul;paul.mercier@atelier-lumen;Finance;2e',
    'Roche;Yanis;yanis@example.test;Marketing;',
    'Robin;Claire;CLAIRE@example.test;Finance;4e',
    'Robin;Claire;claire@example.test;Finance;4e',
    ';;vide@example.test;;',
  ].join('\n');

  it('says what it would do, and writes nothing', async () => {
    const preview = await previewDirectoryImport(
      any,
      ORGANIZATION_ID,
      FILE,
      [],
    );

    expect(preview).toMatchObject({
      separator: ';',
      lines: 5,
      missing: [],
      toAdd: 1,
      toUpdate: 0,
      unknownDepartments: [{ name: 'Marketing', lines: 1 }],
    });
    expect(preview.errors.map((row) => [row.line, row.problem])).toEqual([
      [2, 'email-invalid'],
      [3, 'department-unknown'],
      [5, 'duplicate-in-file'],
      [6, 'name-missing'],
    ]);
    const stored = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.email, 'claire@example.test'));
    expect(stored).toEqual([]);
  });

  it('names the columns a file lacks', async () => {
    const preview = await previewDirectoryImport(
      any,
      ORGANIZATION_ID,
      'prenom;service\nPaul;Finance',
      [],
    );
    expect(preview.missing).toEqual(['lastName', 'email']);
  });

  it('adds, updates, moves by e-mail, and keeps those the file omits', async () => {
    const absent = await addPerson(db, finance);
    const person = await addPerson(db, finance);
    const parcel = await addParcel(person);
    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    const file = [
      'mail,nom,prenom,departement',
      `${row!.email.toUpperCase()},Haddad,Nora,Studio`,
      'lea@example.test,Fontaine,Léa,Marketing',
      'ines@example.test,Garnier,Inès,',
    ].join('\n');

    const choices = [{ name: 'Marketing', departmentId: studio }];
    const preview = await previewDirectoryImport(
      any,
      ORGANIZATION_ID,
      file,
      choices,
    );
    expect(preview.toMove).toBe(1);

    const report = await applyDirectoryImport(
      any,
      ORGANIZATION_ID,
      file,
      choices,
    );

    expect(report).toEqual({ added: 2, updated: 1, unchanged: 0, ignored: 0 });
    expect((await parcelOf(parcel)).departmentId).toBe(studio);
    const [lea] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.email, 'lea@example.test'));
    expect(lea).toMatchObject({ departmentId: studio, department: 'Studio' });
    const [kept] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, absent));
    expect(kept).toMatchObject({ active: true, departmentId: finance });
  });

  it('ignores a choice pointing at a department of another company', async () => {
    const foreign = await addDepartment(db, 'Ailleurs', OTHER_ORGANIZATION_ID);
    const preview = await previewDirectoryImport(
      any,
      ORGANIZATION_ID,
      'nom,mail,service\nDupont Jean,jean@example.test,Marketing',
      [{ name: 'Marketing', departmentId: foreign }],
    );
    expect(preview.unknownDepartments).toEqual([
      { name: 'Marketing', lines: 1 },
    ]);
  });

  it('never erases a name with an empty cell, and adds nobody without both', async () => {
    const person = await addPerson(db, finance);
    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    const report = await applyDirectoryImport(
      any,
      ORGANIZATION_ID,
      `nom,prenom,mail\nHaddad-Petit,,${row!.email}\nSeul,,seul@example.test`,
      [],
    );
    expect(report).toEqual({ added: 0, updated: 1, unchanged: 0, ignored: 1 });
    const [after] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    expect(after).toMatchObject({
      firstName: 'Nora',
      lastName: 'Haddad-Petit',
    });
  });

  it('keeps a compound first name when one column holds the same name', async () => {
    const person = await addPerson(db, finance);
    await db
      .update(schema.directoryPerson)
      .set({ firstName: 'Jean Pierre', lastName: 'Dupont' })
      .where(eq(schema.directoryPerson.id, person));
    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    const report = await applyDirectoryImport(
      any,
      ORGANIZATION_ID,
      `nom,mail\nJean Pierre Dupont,${row!.email}`,
      [],
    );
    expect(report.unchanged).toBe(1);
  });

  it('does not touch a line it has nothing to say about', async () => {
    const person = await addPerson(db, finance);
    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    const report = await applyDirectoryImport(
      any,
      ORGANIZATION_ID,
      `nom,prenom,mail,service\nHaddad,Nora,${row!.email},`,
      [],
    );
    expect(report.unchanged).toBe(1);
    const [after] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));
    expect(after).toMatchObject({ departmentId: finance });
  });
});

describe('one address in several departments', () => {
  const email = (word: string) => `${word}.${newId()}@example.test`;
  const addAt = async (departmentId: string | null, address: string) => {
    const person = await addPerson(db, departmentId);
    await db
      .update(schema.directoryPerson)
      .set({ email: address })
      .where(eq(schema.directoryPerson.id, person));
    return person;
  };
  const departmentOf = async (id: string) =>
    (
      await db
        .select()
        .from(schema.directoryPerson)
        .where(eq(schema.directoryPerson.id, id))
    )[0]!.departmentId;

  it('a department adds an address another holds: nothing tells it so', async () => {
    const address = email('hugo');
    const other = await addAt(finance, address);
    const id = newId();

    const { results } = await push(any, accessOf('department', studio), {
      ops: [
        {
          opId: newId(),
          type: 'upsert',
          entity: 'directory_person',
          entityId: id,
          patch: {
            lastName: 'Lefèvre',
            firstName: 'Hugo',
            nameNorm: 'hugo lefevre',
            email: address,
          },
          clientTs: new Date(),
        },
      ],
    });

    expect(results[0]?.status).toBe(200);
    expect(await departmentOf(id)).toBe(studio);
    expect(await departmentOf(other)).toBe(finance);
  });

  it('keeps one card per address inside a department, and among those in none', async () => {
    for (const department of [studio, null]) {
      const address = email('dup');
      await addAt(department, address);
      await expect(addAt(department, address.toUpperCase())).rejects.toThrow();
    }
  });

  it('refuses to move someone onto the card of the same address, moving nothing', async () => {
    const address = email('twin');
    const here = await addAt(finance, address);
    await addAt(studio, address);

    await expect(move(here, studio)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(await departmentOf(here)).toBe(finance);
  });

  it('imports onto the card of the department the line names, or asks which', async () => {
    const address = email('both');
    await addAt(finance, address);
    const there = await addAt(studio, address);
    const csv = `nom,prenom,mail,service,bureau\nLefèvre,Hugo,${address},Studio,Étage 2`;

    const report = await applyDirectoryImport(any, ORGANIZATION_ID, csv, []);
    expect(report.updated).toBe(1);
    const [row] = await db
      .select()
      .from(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, there));
    expect(row?.site).toBe('Étage 2');

    const preview = await previewDirectoryImport(
      any,
      ORGANIZATION_ID,
      `nom,prenom,mail\nLefèvre,Hugo,${address}`,
      [],
    );
    expect(preview.errors.map((error) => error.problem)).toEqual([
      'email-ambiguous',
    ]);
  });
});

describe('a request to move someone', () => {
  const mine = () => accessOf('department', studio);
  const openFor = async (access: ReturnType<typeof accessOf>, id: string) =>
    (await moveRequestsOf(any, access)).filter((row) => row.personId === id);

  it('reaches the admin, not the other departments', async () => {
    const person = await addPerson(db, studio);
    await requestMove(any, mine(), { personId: person, note: 'Parti' });

    expect(await openFor(accessOf('company_admin'), person)).toMatchObject([
      { departmentName: 'Studio', note: 'Parti' },
    ]);
    expect(await openFor(mine(), person)).toHaveLength(1);
    expect(await openFor(accessOf('department', finance), person)).toEqual([]);
  });

  it('answers the same for someone elsewhere and for nobody', async () => {
    const elsewhere = await addPerson(db, finance);
    for (const personId of [elsewhere, newId()]) {
      await expect(
        requestMove(any, mine(), { personId, note: null }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(await openFor(accessOf('company_admin'), elsewhere)).toEqual([]);
  });

  it('asked twice stays one, with the last note', async () => {
    const person = await addPerson(db, studio);
    await requestMove(any, mine(), { personId: person, note: 'Un' });
    await requestMove(any, mine(), { personId: person, note: 'Deux' });

    expect(await openFor(accessOf('company_admin'), person)).toMatchObject([
      { note: 'Deux' },
    ]);
  });

  it('ends when the person moves', async () => {
    const person = await addPerson(db, studio);
    await requestMove(any, mine(), { personId: person, note: null });

    await move(person, finance);
    expect(await openFor(accessOf('company_admin'), person)).toEqual([]);

    await move(person, studio);
    expect(await openFor(accessOf('company_admin'), person)).toEqual([]);
  });

  it('goes with a person the purge erases', async () => {
    const person = await addPerson(db, studio);
    await requestMove(any, mine(), { personId: person, note: 'Parti' });

    await db
      .delete(schema.directoryPerson)
      .where(eq(schema.directoryPerson.id, person));

    expect(await openFor(accessOf('company_admin'), person)).toEqual([]);
  });

  it('a department closes its own request only, the admin any', async () => {
    const person = await addPerson(db, studio);
    await requestMove(any, mine(), { personId: person, note: null });

    await closeMoveRequest(any, accessOf('department', finance), person);
    expect(await openFor(mine(), person)).toHaveLength(1);

    await closeMoveRequest(any, accessOf('company_admin'), person);
    expect(await openFor(mine(), person)).toEqual([]);

    await requestMove(any, mine(), { personId: person, note: 'Encore' });
    expect(await openFor(mine(), person)).toHaveLength(1);
  });
});
