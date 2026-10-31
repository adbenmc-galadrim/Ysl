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
import { moveEffectsOf, movePerson } from '#features/directory/service';
import { pull } from '#features/sync/pull';
import { push } from '#features/sync/push';
import { accessOf, addDepartment, addPerson } from './helpers/departments';
import {
  asAnyDb,
  openTestDb,
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
    },
  );

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
    } = await push(any, accessOf('admin'), {
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

    const report = await applyDirectoryImport(any, ORGANIZATION_ID, file, [
      { name: 'Marketing', departmentId: studio },
    ]);

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
