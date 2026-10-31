import type { PGlite } from '@electric-sql/pglite';
import type { AnyDb } from '@repo/db';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import type { SyncOp, SyncedEntity } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { push } from '#features/sync/push';
import type { Access } from '#lib/access';
import {
  accessOf,
  addContact,
  addDepartment,
  addPerson,
} from './helpers/departments';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;
let sync: AnyDb;
let finance: string;
let legal: string;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  sync = asAnyDb(db);
  finance = await addDepartment(db, 'Finance');
  legal = await addDepartment(db, 'Juridique');
});

afterAll(async () => {
  await client.close();
});

const NOW = new Date('2026-10-31T09:00:00Z');

function op(
  entity: SyncedEntity,
  entityId: string,
  patch: Record<string, unknown>,
  type: SyncOp['type'] = 'upsert',
): SyncOp {
  return { opId: newId(), entity, entityId, type, patch, clientTs: NOW };
}

async function statusOf(access: Access, write: SyncOp) {
  const { results } = await push(sync, access, { ops: [write] });
  return results[0]?.status;
}

async function addParcel(values: Partial<typeof schema.parcel.$inferInsert>) {
  const row = { ...parcelRow(), ...values };
  await db.insert(schema.parcel).values(row);
  return row.id;
}

const person = (departmentId?: string | null) => ({
  lastName: 'Martin',
  firstName: 'Léa',
  nameNorm: 'lea martin',
  email: `lea.${newId()}@example.test`,
  ...(departmentId === undefined ? {} : { departmentId }),
});

const newParcel = (extra: Record<string, unknown> = {}) => ({
  status: 'recu',
  receivedAt: NOW,
  receivedBy: AGENT_ID,
  ...extra,
});

const code = (extra: Record<string, unknown>) => ({
  tokenHash: newId(),
  pinHash: 'pin',
  expiresAt: new Date(NOW.getTime() + 86_400_000),
  ...extra,
});

async function storedParcel(id: string) {
  const [row] = await db
    .select()
    .from(schema.parcel)
    .where(eq(schema.parcel.id, id));
  return row;
}

const handoverRow = (parcelIds: string[], personId: string) => ({
  parcelIds,
  personId,
  recipientName: 'Léa Martin',
  method: 'pin',
  agentId: AGENT_ID,
  at: NOW,
});

describe('sync.push by role', () => {
  describe('the roles of before', () => {
    it.each(['agent', 'admin'] as const)(
      '%s still writes the directory and hands over',
      async (role) => {
        const access = accessOf(role);
        const personId = newId();
        expect(
          await statusOf(access, op('directory_person', personId, person())),
        ).toBe(200);
        const parcelId = await addParcel({ personId });
        expect(
          await statusOf(
            access,
            op('handover', newId(), handoverRow([parcelId], personId)),
          ),
        ).toBe(200);
      },
    );
  });

  describe('everyone', () => {
    it.each(['agent', 'admin', 'company_admin', 'shuttle'] as const)(
      '%s writes no department through the sync',
      async (role) => {
        expect(
          await statusOf(
            accessOf(role),
            op('department', finance, { name: 'Autre nom' }),
          ),
        ).toBe(403);
      },
    );
  });

  describe('the shuttle', () => {
    const shuttle = () => accessOf('shuttle');

    it('reads the directory but does not write it', async () => {
      const id = await addPerson(db, finance);
      expect(
        await statusOf(shuttle(), op('directory_person', newId(), person())),
      ).toBe(403);
      expect(
        await statusOf(shuttle(), op('directory_person', id, {}, 'delete')),
      ).toBe(403);
    });

    it('receives parcels and notes a contact, the way it works', async () => {
      expect(
        await statusOf(shuttle(), op('parcel', newId(), newParcel())),
      ).toBe(200);
      expect(
        await statusOf(
          shuttle(),
          op('contact', newId(), { name: 'Marc', nameNorm: 'marc' }),
        ),
      ).toBe(200);
    });

    it('does not hand over: no handover, no parcel in or out of remis, no code used', async () => {
      const personId = await addPerson(db, finance);
      const parcelId = await addParcel({ personId, status: 'notifie' });
      expect(
        await statusOf(
          shuttle(),
          op('handover', newId(), handoverRow([parcelId], personId)),
        ),
      ).toBe(403);
      expect(
        await statusOf(
          shuttle(),
          op('parcel', parcelId, {
            status: 'remis',
            deliveredAt: NOW,
            deliveredBy: AGENT_ID,
          }),
        ),
      ).toBe(403);
      const codeId = newId();
      expect(
        await statusOf(
          shuttle(),
          op('pickup_code', codeId, code({ personId, departmentId: finance })),
        ),
      ).toBe(200);
      expect(
        await statusOf(
          shuttle(),
          op(
            'pickup_code',
            codeId,
            code({ personId, departmentId: finance, usedAt: NOW }),
          ),
        ),
      ).toBe(403);
    });
  });

  describe('the company admin', () => {
    it('writes the directory of every department but does not hand over', async () => {
      const access = accessOf('company_admin');
      const personId = newId();
      expect(
        await statusOf(access, op('directory_person', personId, person(legal))),
      ).toBe(200);
      const parcelId = await addParcel({ personId });
      expect(
        await statusOf(
          access,
          op('handover', newId(), handoverRow([parcelId], personId)),
        ),
      ).toBe(403);
    });
  });

  describe('a department', () => {
    const own = () => accessOf('department', finance);

    it('writes its own directory, stamped with its department whatever the copy says', async () => {
      const id = newId();
      expect(
        await statusOf(own(), op('directory_person', id, person(legal))),
      ).toBe(200);
      const [row] = await db
        .select()
        .from(schema.directoryPerson)
        .where(eq(schema.directoryPerson.id, id));
      expect(row?.departmentId).toBe(finance);
    });

    it('does not touch the directory of another, nor a person of none', async () => {
      for (const departmentId of [legal, null]) {
        const id = await addPerson(db, departmentId);
        expect(
          await statusOf(own(), op('directory_person', id, person(finance))),
        ).toBe(403);
        expect(
          await statusOf(own(), op('directory_person', id, {}, 'delete')),
        ).toBe(403);
      }
    });

    it('updates its own parcels, and gives none away', async () => {
      const personId = await addPerson(db, finance);
      const parcelId = await addParcel({ personId });
      expect(
        await statusOf(
          own(),
          op(
            'parcel',
            parcelId,
            newParcel({ notes: 'étagère 3', departmentId: legal }),
          ),
        ),
      ).toBe(200);
      const row = await storedParcel(parcelId);
      expect(row).toMatchObject({ notes: 'étagère 3', departmentId: finance });

      expect(
        await statusOf(
          own(),
          op('parcel', parcelId, { personId: await addPerson(db, legal) }),
        ),
      ).toBe(403);
    });

    it('still writes a parcel whose person has moved away, naming the same person', async () => {
      const personId = await addPerson(db, finance);
      const parcelId = await addParcel({ personId });
      await db
        .update(schema.directoryPerson)
        .set({ departmentId: legal })
        .where(eq(schema.directoryPerson.id, personId));

      expect(
        await statusOf(
          own(),
          op('parcel', parcelId, newParcel({ personId, notes: 'en rayon' })),
        ),
      ).toBe(200);
      expect(await storedParcel(parcelId)).toMatchObject({
        notes: 'en rayon',
        departmentId: finance,
      });
    });

    it('does not write a parcel of another, one without a department, nor a new one', async () => {
      const theirs = await addParcel({
        personId: await addPerson(db, legal),
      });
      const loose = await addParcel({});
      expect(await statusOf(own(), op('parcel', theirs, { notes: 'x' }))).toBe(
        403,
      );
      expect(await statusOf(own(), op('parcel', loose, { notes: 'x' }))).toBe(
        403,
      );
      expect(await statusOf(own(), op('parcel', newId(), newParcel()))).toBe(
        403,
      );
    });

    it('cannot reach a contact by naming it on its parcel', async () => {
      const parcelId = await addParcel({
        personId: await addPerson(db, finance),
      });
      const someoneElses = await addContact(db);
      expect(
        await statusOf(
          own(),
          op('parcel', parcelId, { contactId: someoneElses, personId: null }),
        ),
      ).toBe(403);
    });

    it('hands over its own parcels only', async () => {
      const personId = await addPerson(db, finance);
      const mine = await addParcel({ personId });
      const theirs = await addParcel({ personId: await addPerson(db, legal) });
      expect(
        await statusOf(
          own(),
          op('handover', newId(), handoverRow([mine, theirs], personId)),
        ),
      ).toBe(403);
      expect(
        await statusOf(
          own(),
          op('handover', newId(), handoverRow([mine], personId)),
        ),
      ).toBe(200);
    });

    it('issues codes in its own department only', async () => {
      const personId = await addPerson(db, finance);
      const id = newId();
      expect(
        await statusOf(
          own(),
          op('pickup_code', id, code({ personId, departmentId: legal })),
        ),
      ).toBe(200);
      const [row] = await db
        .select()
        .from(schema.pickupCode)
        .where(eq(schema.pickupCode.id, id));
      expect(row?.departmentId).toBe(finance);

      expect(
        await statusOf(
          own(),
          op(
            'pickup_code',
            newId(),
            code({ personId: await addPerson(db, legal) }),
          ),
        ),
      ).toBe(403);
    });

    it('issues no code to a contact it does not hold', async () => {
      const contactId = await addContact(db);
      expect(
        await statusOf(own(), op('pickup_code', newId(), code({ contactId }))),
      ).toBe(403);
    });

    it('writes the journal of its own parcels only', async () => {
      const event = (entityId: string, entity = PARCEL_EVENT_ENTITY) => ({
        entity,
        entityId,
        type: 'parcel.moved',
        at: NOW,
      });
      const mine = await addParcel({ personId: await addPerson(db, finance) });
      const theirs = await addParcel({ personId: await addPerson(db, legal) });
      expect(await statusOf(own(), op('event', newId(), event(mine)))).toBe(
        200,
      );
      expect(await statusOf(own(), op('event', newId(), event(theirs)))).toBe(
        403,
      );
      expect(
        await statusOf(own(), op('event', newId(), event(newId(), 'batch'))),
      ).toBe(403);
    });

    it.each(['batch', 'sender', 'sender_alias', 'recipient_alias'] as const)(
      'does not write %s',
      async (entity) => {
        expect(await statusOf(own(), op(entity, newId(), {}))).toBe(403);
      },
    );
  });

  describe('the department of a parcel', () => {
    it('follows its person: a stale copy says nothing', async () => {
      const access = accessOf('shuttle');
      const personId = await addPerson(db, finance);
      const id = newId();
      expect(
        await statusOf(
          access,
          op('parcel', id, newParcel({ personId, departmentId: legal })),
        ),
      ).toBe(200);
      expect((await storedParcel(id))?.departmentId).toBe(finance);
    });

    it('is the one a company account says when nobody in the directory is named', async () => {
      const access = accessOf('shuttle');
      const contactId = await addContact(db);
      const id = newId();
      expect(
        await statusOf(
          access,
          op('parcel', id, newParcel({ contactId, departmentId: legal })),
        ),
      ).toBe(200);
      expect((await storedParcel(id))?.departmentId).toBe(legal);
    });

    it('stays out of reach of a department of another company', async () => {
      const foreign = await addDepartment(
        db,
        'Finance',
        (
          await db
            .select({ id: schema.organization.id })
            .from(schema.organization)
        ).find(({ id }) => id !== ORGANIZATION_ID)!.id,
      );
      expect(
        await statusOf(
          accessOf('shuttle'),
          op('parcel', newId(), newParcel({ departmentId: foreign })),
        ),
      ).toBeGreaterThanOrEqual(400);
    });
  });
});
