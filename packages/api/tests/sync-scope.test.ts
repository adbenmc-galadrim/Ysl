import type { PGlite } from '@electric-sql/pglite';
import type { AnyDb } from '@repo/db';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import type { PullOutput, SyncCursor, SyncedEntity } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pull } from '#features/sync/pull';
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
  OTHER_ORGANIZATION_ID,
  parcelRow,
  STRANGER_ID,
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

beforeEach(async () => {
  await db.update(schema.department).set({ scopeXid: null });
});

async function read(
  access: Access,
  cursor: SyncCursor | null = null,
): Promise<{
  last: PullOutput;
  reset: boolean;
  ids: Map<SyncedEntity, string[]>;
}> {
  const ids = new Map<SyncedEntity, string[]>();
  let output = await pull(sync, access, {
    cursor,
    page: null,
    limit: 3,
    departments: true,
  });
  let reset = false;
  for (;;) {
    reset ||= output.reset;
    for (const { entity, row } of output.rows) {
      ids.set(entity, [...(ids.get(entity) ?? []), row.id]);
    }
    if (!output.next) return { last: output, reset, ids };
    output = await pull(sync, access, {
      cursor: null,
      page: output.next,
      limit: 3,
      departments: true,
    });
  }
}

const cursorOf = ({ generation, cursor }: PullOutput): SyncCursor => ({
  generation,
  xid: cursor,
});

async function addParcel(values: Partial<typeof schema.parcel.$inferInsert>) {
  const row = { ...parcelRow(), ...values };
  await db.insert(schema.parcel).values(row);
  return row.id;
}

describe('sync.pull by role', () => {
  it('gives each role what §2.1 says, and nothing of another company', async () => {
    const mine = await addPerson(db, finance);
    const theirs = await addPerson(db, legal);
    const unattached = await addPerson(db, null);
    const foreign = await addPerson(db, null, OTHER_ORGANIZATION_ID);
    const myParcel = await addParcel({ personId: mine });
    const theirParcel = await addParcel({ personId: theirs });
    const looseParcel = await addParcel({ personId: unattached });
    const foreignParcel = await addParcel({
      ...parcelRow(OTHER_ORGANIZATION_ID),
      personId: foreign,
    });
    const everything = [myParcel, theirParcel, looseParcel];

    const department = (await read(accessOf('department', finance))).ids;
    expect(department.get('parcel')).toEqual([myParcel]);
    expect(department.get('directory_person')).toEqual([mine]);
    expect(department.get('department')).toEqual([finance]);

    for (const role of [
      'company_admin',
      'shuttle',
      'admin',
      'agent',
    ] as const) {
      const seen = (await read(accessOf(role))).ids;
      expect(seen.get('parcel')).toEqual(expect.arrayContaining(everything));
      expect(seen.get('parcel')).not.toContain(foreignParcel);
      expect(seen.get('directory_person')).toEqual(
        expect.arrayContaining([mine, theirs, unattached]),
      );
      expect(seen.get('directory_person')).not.toContain(foreign);
      expect(seen.get('department')).toEqual(
        expect.arrayContaining([finance, legal]),
      );
    }
  });

  it('keeps the rows that hang on a parcel within its department', async () => {
    const legalPerson = await addPerson(db, legal);
    const financePerson = await addPerson(db, finance);
    const myParcel = await addParcel({ personId: financePerson });
    const theirParcel = await addParcel({ personId: legalPerson });
    const hanging = (parcelId: string, personId: string) => ({
      notification: {
        id: newId(),
        organizationId: ORGANIZATION_ID,
        type: 'avis' as const,
        personId,
        recipients: ['a@example.test'],
        parcelIds: [parcelId],
        preparedAt: new Date(),
        preparedBy: AGENT_ID,
      },
      event: {
        id: newId(),
        organizationId: ORGANIZATION_ID,
        entity: PARCEL_EVENT_ENTITY,
        entityId: parcelId,
        type: 'parcel.received',
        at: new Date(),
      },
    });
    const mine = hanging(myParcel, financePerson);
    const theirs = hanging(theirParcel, legalPerson);
    await db
      .insert(schema.notification)
      .values([mine.notification, theirs.notification]);
    await db.insert(schema.event).values([mine.event, theirs.event]);
    const code = (personId: string, departmentId: string | null) => ({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      personId,
      departmentId,
      tokenHash: newId(),
      pinHash: 'pin',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const myCode = code(financePerson, finance);
    const theirCode = code(legalPerson, legal);
    const noDepartment = code(await addPerson(db, null), null);
    await db
      .insert(schema.pickupCode)
      .values([myCode, theirCode, noDepartment]);

    const { ids } = await read(accessOf('department', finance));

    expect(ids.get('notification')).toContain(mine.notification.id);
    expect(ids.get('notification')).not.toContain(theirs.notification.id);
    expect(ids.get('event')).toContain(mine.event.id);
    expect(ids.get('event')).not.toContain(theirs.event.id);
    expect(ids.get('pickup_code')).toContain(myCode.id);
    expect(ids.get('pickup_code')).not.toContain(theirCode.id);
    expect(ids.get('pickup_code')).not.toContain(noDepartment.id);
  });

  it('never gives a department a parcel without one, nor the shuttle’s tables', async () => {
    const loose = await addParcel({});
    await db.insert(schema.sender).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      displayName: 'Zalando',
      nameNorm: 'zalando',
    });

    const { ids } = await read(accessOf('department', finance));

    expect(ids.get('parcel')).not.toContain(loose);
    expect(ids.get('sender')).toBeUndefined();
    expect(ids.get('batch')).toBeUndefined();
    expect(ids.get('sender_account')).toBeUndefined();
    expect(ids.get('recipient_alias')).toBeUndefined();
    const adminIds = (await read(accessOf('company_admin'))).ids;
    expect(adminIds.get('parcel')).toContain(loose);
  });

  it('brings a contact older than the parcel that reaches the department, not one of another', async () => {
    const access = accessOf('department', finance);
    const contactId = await addContact(db);
    const otherContact = await addContact(db);
    await addParcel({ contactId: otherContact, departmentId: legal });
    const start = cursorOf((await read(access)).last);
    expect((await read(access)).ids.get('contact') ?? []).not.toContain(
      contactId,
    );

    const parcelId = await addParcel({ contactId, departmentId: finance });
    const { ids, reset } = await read(access, start);

    expect(reset).toBe(false);
    expect(ids.get('parcel')).toEqual([parcelId]);
    expect(ids.get('contact')).toEqual([contactId]);
  });

  it('brings the journal of a parcel that reaches the department from none', async () => {
    const access = accessOf('department', finance);
    const parcelId = await addParcel({});
    const eventId = newId();
    await db.insert(schema.event).values({
      id: eventId,
      organizationId: ORGANIZATION_ID,
      entity: PARCEL_EVENT_ENTITY,
      entityId: parcelId,
      type: 'parcel.received',
      at: new Date(),
    });
    const start = cursorOf((await read(access)).last);

    await db
      .update(schema.parcel)
      .set({ departmentId: finance })
      .where(eq(schema.parcel.id, parcelId));
    const { ids, reset } = await read(access, start);

    expect(reset).toBe(false);
    expect(ids.get('event')).toEqual([eventId]);
  });

  it('starts a department over when a parcel leaves it, without the parcel', async () => {
    const finances = accessOf('department', finance);
    const legals = accessOf('department', legal);
    const parcelId = await addParcel({ departmentId: finance });
    const financeStart = cursorOf((await read(finances)).last);
    const legalStart = cursorOf((await read(legals)).last);

    await db
      .update(schema.parcel)
      .set({ departmentId: legal })
      .where(eq(schema.parcel.id, parcelId));

    const left = await read(finances, financeStart);
    expect(left.reset).toBe(true);
    expect(left.ids.get('parcel') ?? []).not.toContain(parcelId);

    const next = await read(finances, cursorOf(left.last));
    expect(next.reset).toBe(false);

    const reached = await read(legals, legalStart);
    expect(reached.reset).toBe(false);
    expect(reached.ids.get('parcel')).toEqual([parcelId]);
  });

  it('starts a department over when a pushed copy gives the parcel to someone of another', async () => {
    const finances = accessOf('department', finance);
    const parcelId = await addParcel({
      personId: await addPerson(db, finance),
    });
    const start = cursorOf((await read(finances)).last);
    const other = await addPerson(db, legal);

    const { results } = await push(sync, accessOf('company_admin'), {
      ops: [
        {
          opId: newId(),
          entity: 'parcel',
          entityId: parcelId,
          type: 'upsert',
          patch: { ...parcelRow(), id: parcelId, personId: other },
          clientTs: new Date(),
        },
      ],
    });
    expect(results[0]?.status).toBe(200);

    const left = await read(finances, start);
    expect(left.reset).toBe(true);
    expect(left.ids.get('parcel') ?? []).not.toContain(parcelId);
  });

  it('starts a device over when its account changes department or role', async () => {
    const asFinance = (await read(accessOf('department', finance))).last;
    const asLegal = await read(
      accessOf('department', legal),
      cursorOf(asFinance),
    );
    expect(asLegal.reset).toBe(true);

    const asAgent = (await read(accessOf('agent'))).last;
    const converted = await read(
      accessOf('department', finance),
      cursorOf(asAgent),
    );
    expect(converted.reset).toBe(true);
    expect(asAgent.generation).not.toBe(asFinance.generation);
  });

  it('leaves a company reader on the server’s generation', async () => {
    const [row] = await db.select().from(schema.syncGeneration);
    for (const role of [
      'agent',
      'admin',
      'company_admin',
      'shuttle',
    ] as const) {
      expect((await read(accessOf(role))).last.generation).toBe(
        row?.generation,
      );
    }
  });

  it('sends no department to an app that does not announce it, and no scope mark to anyone', async () => {
    const output = await pull(sync, accessOf('agent'), {
      cursor: null,
      page: null,
      limit: 1000,
    });
    expect(output.rows.map(({ entity }) => entity)).not.toContain('department');

    const { rows } = await pull(sync, accessOf('department', finance), {
      cursor: null,
      page: null,
      limit: 1000,
      departments: true,
    });
    const row = rows.find(({ entity }) => entity === 'department')?.row;
    expect(row).toMatchObject({ id: finance, name: 'Finance' });
    expect(row).not.toHaveProperty('scopeXid');
    expect(row).not.toHaveProperty('organizationId');
  });

  it('keeps the e-mail templates of each account to itself', async () => {
    const template = (ownerId: string, organizationId: string) => ({
      id: newId(),
      organizationId,
      type: 'avis' as const,
      name: 'Avis',
      subject: 'Colis',
      body: 'Bonjour',
      ownerId,
    });
    const mine = template(AGENT_ID, ORGANIZATION_ID);
    const foreign = template(STRANGER_ID, OTHER_ORGANIZATION_ID);
    await db.insert(schema.emailTemplate).values([mine, foreign]);

    const { ids } = await read(accessOf('department', finance));

    expect(ids.get('email_template')).toEqual([mine.id]);
  });
});
