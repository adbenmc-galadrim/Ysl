import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { EMPTY_PICKUP } from '@repo/contract/settings';
import {
  departmentMember,
  directoryPerson,
  organizationMember,
  parcel,
  user,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({
  db,
  pingDb: vi.fn(),
  withConnection: (work: (conn: typeof db) => Promise<unknown>) => work(db),
}));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID, ORGANIZATION_ID, parcelRow, STRANGER_ID } =
  await import('./helpers/pglite');

const FINANCE_USER = 'finance-1';
const FINANCE_USER_2 = 'finance-2';
const STUDIO_USER = 'studio-1';
const LOOSE_USER = 'loose-1';

function sessionOf(userId: string, role: string): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId },
    user: { ...base.user, id: userId },
  };
}

const admin = () => callerFor(sessionOf(AGENT_ID, 'company_admin'));
const otherAdmin = () => callerFor(sessionOf(STRANGER_ID, 'company_admin'));
const financeAccount = () => callerFor(sessionOf(FINANCE_USER, 'department'));
const studioAccount = () => callerFor(sessionOf(STUDIO_USER, 'department'));
const shuttle = () => callerFor(sessionOf(AGENT_ID, 'shuttle'));

const pickup = { ...EMPTY_PICKUP, place: 'Accueil, 2e étage' };

let financeId: string;
let studioId: string;

beforeAll(async () => {
  const accounts = [FINANCE_USER, FINANCE_USER_2, STUDIO_USER, LOOSE_USER];
  await db.insert(user).values(
    accounts.map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      role: 'department',
    })),
  );
  await db.insert(organizationMember).values(
    accounts.map((userId) => ({
      userId,
      organizationId: ORGANIZATION_ID,
    })),
  );
  financeId = (await admin().departments.create({ name: 'Finance' })).id;
  studioId = (
    await admin().departments.create({
      name: 'Service courrier',
      receptionPoint: 'Quai',
    })
  ).id;
  await admin().departments.attachAccount({
    userId: FINANCE_USER,
    departmentId: financeId,
  });
  await admin().departments.attachAccount({
    userId: FINANCE_USER_2,
    departmentId: financeId,
  });
  await admin().departments.attachAccount({
    userId: STUDIO_USER,
    departmentId: studioId,
  });
});

afterAll(async () => {
  await client.close();
});

describe('departments.list', () => {
  it('shows the company admin and the shuttle all of their company', async () => {
    for (const caller of [admin(), shuttle()]) {
      expect((await caller.departments.list()).map((d) => d.name)).toEqual([
        'Finance',
        'Service courrier',
      ]);
    }
  });

  it('shows a department only itself, to each of its accounts', async () => {
    for (const userId of [FINANCE_USER, FINANCE_USER_2]) {
      const list = await callerFor(
        sessionOf(userId, 'department'),
      ).departments.list();
      expect(list.map((d) => d.id)).toEqual([financeId]);
    }
  });

  it('shows nothing to a department account not attached yet', async () => {
    await expect(
      callerFor(sessionOf(LOOSE_USER, 'department')).departments.list(),
    ).resolves.toEqual([]);
  });

  it('shows nothing of another company', async () => {
    await expect(otherAdmin().departments.list()).resolves.toEqual([]);
  });
});

describe('departments.create and update', () => {
  it('refuses a department account and a shuttle', async () => {
    for (const caller of [financeAccount(), shuttle()]) {
      await expect(
        caller.departments.create({ name: 'Studio' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        caller.departments.update({
          id: financeId,
          name: 'Renommé',
          receptionPoint: null,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('refuses a name already taken, whatever its case', async () => {
    await expect(
      admin().departments.create({ name: 'finance' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      admin().departments.update({
        id: studioId,
        name: 'FINANCE',
        receptionPoint: null,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lets another company use the same name', async () => {
    await expect(
      otherAdmin().departments.create({ name: 'Finance' }),
    ).resolves.toMatchObject({ name: 'Finance' });
  });

  it('cannot reach the department of another company', async () => {
    await expect(
      otherAdmin().departments.update({
        id: financeId,
        name: 'Volé',
        receptionPoint: null,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('departments.updatePickup', () => {
  it('lets a department write its own place and hours', async () => {
    await expect(
      financeAccount().departments.updatePickup({ id: financeId, pickup }),
    ).resolves.toMatchObject({ pickup });
  });

  it('lets the company admin write them too', async () => {
    await expect(
      admin().departments.updatePickup({ id: studioId, pickup }),
    ).resolves.toMatchObject({ pickup });
  });

  it('refuses another department and the shuttle', async () => {
    for (const caller of [studioAccount(), shuttle()]) {
      await expect(
        caller.departments.updatePickup({ id: financeId, pickup }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });
});

describe('departments.attachAccount', () => {
  it('refuses an account of another company', async () => {
    await expect(
      admin().departments.attachAccount({
        userId: STRANGER_ID,
        departmentId: financeId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a department of another company', async () => {
    const [foreign] = await otherAdmin().departments.list();
    await expect(
      admin().departments.attachAccount({
        userId: LOOSE_USER,
        departmentId: foreign?.id ?? newId(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses an account that is not a department account', async () => {
    await expect(
      admin().departments.attachAccount({
        userId: AGENT_ID,
        departmentId: financeId,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('moves an account from one department to another, then detaches it', async () => {
    const attach = (departmentId: string | null) =>
      admin().departments.attachAccount({ userId: LOOSE_USER, departmentId });
    const loose = () =>
      callerFor(sessionOf(LOOSE_USER, 'department')).departments.list();

    await attach(financeId);
    expect((await loose()).map((d) => d.id)).toEqual([financeId]);
    await attach(studioId);
    expect((await loose()).map((d) => d.id)).toEqual([studioId]);
    await attach(null);
    await expect(loose()).resolves.toEqual([]);
    expect(await db.select().from(departmentMember)).toHaveLength(3);
  });
});

describe('departments.archive', () => {
  it('refuses a department that still has accounts', async () => {
    await expect(
      admin().departments.archive({ id: financeId }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('hides an empty department and frees its name', async () => {
    const { id } = await admin().departments.create({ name: 'Studio' });
    await admin().departments.archive({ id });
    expect((await admin().departments.list()).map((d) => d.id)).not.toContain(
      id,
    );
    await expect(
      admin().departments.attachAccount({
        userId: LOOSE_USER,
        departmentId: id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      admin().departments.create({ name: 'Studio' }),
    ).resolves.toMatchObject({ name: 'Studio' });
  });

  it.each([
    [
      'a person',
      (departmentId: string) =>
        db.insert(directoryPerson).values({
          id: newId(),
          organizationId: ORGANIZATION_ID,
          lastName: 'Haddad',
          firstName: 'Nora',
          nameNorm: 'nora haddad',
          email: `nora.${departmentId}@example.test`,
          departmentId,
        }),
    ],
    [
      'a parcel waiting',
      (departmentId: string) =>
        db.insert(parcel).values({ ...parcelRow(), departmentId }),
    ],
  ])('refuses while it holds %s', async (what, seed) => {
    const { id } = await admin().departments.create({ name: `Tenu ${what}` });
    await seed(id);

    await expect(admin().departments.archive({ id })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('archives a department whose parcels are all handed over', async () => {
    const { id } = await admin().departments.create({ name: 'Vidé' });
    await db.insert(parcel).values({
      ...parcelRow(),
      departmentId: id,
      status: 'retourne',
    });

    await expect(admin().departments.archive({ id })).resolves.toBeUndefined();
  });

  it('cannot archive the department of another company', async () => {
    const { id } = await admin().departments.create({ name: 'Paie' });
    await expect(
      otherAdmin().departments.archive({ id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
