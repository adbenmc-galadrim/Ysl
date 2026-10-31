import type { PGlite } from '@electric-sql/pglite';
import type { AnyDb } from '@repo/db';
import { PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
import { COMPANY_SETTINGS_KEY } from '@repo/contract/company-settings';
import { EMPTY_PICKUP } from '@repo/contract/settings';
import type { SyncOp, SyncedEntity } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeCompanySettings } from '#features/company/settings';
import {
  goesOnTour,
  writeOperatingProfile,
} from '#features/operating/service';
import { push } from '#features/sync/push';
import type { Access } from '#lib/access';
import {
  accessOf,
  addContact,
  addDepartment,
  addPerson,
} from './helpers/departments';
import {
  addOtherShuttle,
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  OTHER_SHUTTLE_ID,
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
  await addOtherShuttle(db);
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
  describe('an archived department', () => {
    it('refuses a parcel pushed into it, and says why', async () => {
      const archived = newId();
      await db.insert(schema.department).values({
        id: archived,
        organizationId: ORGANIZATION_ID,
        name: 'Fermé',
        deletedAt: new Date(),
      });
      const id = newId();
      const { results } = await push(sync, accessOf('company_admin'), {
        ops: [op('parcel', id, newParcel({ departmentId: archived }))],
      });
      expect(results[0]?.status).toBe(409);
      expect(results[0]?.message).toContain('archivé');
    });
  });

  describe('everyone', () => {
    it.each(['company_admin', 'shuttle'] as const)(
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

    it('hands over once the profile says so, and no longer when it stops saying so', async () => {
      const personId = await addPerson(db, finance);
      const handOver = async () => {
        const parcelId = await addParcel({ personId, status: 'notifie' });
        return statusOf(
          shuttle(),
          op('handover', newId(), handoverRow([parcelId], personId)),
        );
      };
      await writeOperatingProfile(
        sync,
        ORGANIZATION_ID,
        SMALL_SITE_OPERATING_PROFILE,
        AGENT_ID,
      );
      expect(await handOver()).toBe(200);
      await writeOperatingProfile(
        sync,
        ORGANIZATION_ID,
        DEFAULT_OPERATING_PROFILE,
        AGENT_ID,
      );
      expect(await handOver()).toBe(403);
    });

    it("takes no profile from a device, an admin's included", async () => {
      expect(
        await statusOf(
          accessOf('company_admin'),
          op('setting', newId(), {
            key: OPERATING_PROFILE_KEY,
            value: SMALL_SITE_OPERATING_PROFILE,
          }),
        ),
      ).toBe(400);
    });

    it('lets no device write the settings of the company', async () => {
      const admin = accessOf('company_admin');
      const value = { retention: { parcel: 1 } };
      expect(
        await statusOf(
          admin,
          op('setting', newId(), { key: COMPANY_SETTINGS_KEY, value }),
        ),
      ).toBe(400);
      await writeCompanySettings(sync, ORGANIZATION_ID, value, AGENT_ID);
      const [row] = await db
        .select({ id: schema.setting.id })
        .from(schema.setting)
        .where(eq(schema.setting.key, COMPANY_SETTINGS_KEY));
      expect(await statusOf(admin, op('setting', row!.id, {}, 'delete'))).toBe(
        403,
      );
      expect(
        await statusOf(
          admin,
          op('setting', row!.id, { key: 'pickup', value: EMPTY_PICKUP }),
        ),
      ).toBe(403);
    });

    it('lets no device delete or reuse the row of the profile', async () => {
      await writeOperatingProfile(
        sync,
        ORGANIZATION_ID,
        SMALL_SITE_OPERATING_PROFILE,
        AGENT_ID,
      );
      const [row] = await db
        .select({ id: schema.setting.id })
        .from(schema.setting)
        .where(eq(schema.setting.key, OPERATING_PROFILE_KEY));
      const admin = accessOf('company_admin');
      expect(await statusOf(admin, op('setting', row!.id, {}, 'delete'))).toBe(
        403,
      );
      expect(
        await statusOf(
          admin,
          op('setting', row!.id, { key: 'pickup', value: EMPTY_PICKUP }),
        ),
      ).toBe(403);
      await writeOperatingProfile(
        sync,
        ORGANIZATION_ID,
        DEFAULT_OPERATING_PROFILE,
        AGENT_ID,
      );
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

    it('still writes a returned parcel, which stayed when its person moved away', async () => {
      const personId = await addPerson(db, finance);
      const parcelId = await addParcel({ personId, status: 'retourne' });
      await db
        .update(schema.directoryPerson)
        .set({ departmentId: legal })
        .where(eq(schema.directoryPerson.id, personId));

      expect(
        await statusOf(
          own(),
          op(
            'parcel',
            parcelId,
            newParcel({ personId, status: 'retourne', notes: 'en rayon' }),
          ),
        ),
      ).toBe(200);
      expect(await storedParcel(parcelId)).toMatchObject({
        notes: 'en rayon',
        departmentId: finance,
      });
    });

    it('no longer writes a parcel that followed its person away', async () => {
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
      ).toBe(403);
      expect((await storedParcel(parcelId))?.departmentId).toBe(legal);
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
        await statusOf(access, op('parcel', id, newParcel({ personId }))),
      ).toBe(200);
      expect((await storedParcel(id))?.departmentId).toBe(finance);
      expect(
        await statusOf(
          access,
          op('parcel', id, newParcel({ personId, departmentId: legal })),
        ),
      ).toBe(200);
      expect((await storedParcel(id))?.departmentId).toBe(finance);
    });

    it('is the one chosen at the review on a new parcel (ME25)', async () => {
      const personId = await addPerson(db, finance);
      const id = newId();
      expect(
        await statusOf(
          accessOf('shuttle'),
          op(
            'parcel',
            id,
            newParcel({ status: 'en_route', personId, departmentId: legal }),
          ),
        ),
      ).toBe(200);
      expect(await storedParcel(id)).toMatchObject({
        status: 'en_route',
        departmentId: legal,
      });
    });

    it('is given to a parcel left without one, and kept going on tour', async () => {
      const access = accessOf('shuttle');
      const personId = await addPerson(db, null);
      const id = newId();
      const parcel = newParcel({ status: 'a_completer', personId });
      expect(await statusOf(access, op('parcel', id, parcel))).toBe(200);
      expect((await storedParcel(id))?.departmentId).toBeNull();
      const chosen = { ...parcel, departmentId: legal };
      expect(
        await statusOf(
          access,
          op('parcel', id, { ...chosen, status: 'recu', statusSeq: 1 }),
        ),
      ).toBe(200);
      expect(
        await statusOf(
          access,
          op('parcel', id, { ...chosen, status: 'en_route', statusSeq: 2 }),
        ),
      ).toBe(200);
      expect(await storedParcel(id)).toMatchObject({
        status: 'en_route',
        departmentId: legal,
      });
    });

    it('empties when the parcel goes to a card without one', async () => {
      const access = accessOf('shuttle');
      const id = newId();
      const personId = await addPerson(db, finance);
      await statusOf(access, op('parcel', id, newParcel({ personId })));
      const blank = await addPerson(db, null);
      await statusOf(access, op('parcel', id, newParcel({ personId: blank })));
      expect((await storedParcel(id))?.departmentId).toBeNull();
    });

    it('stays on a parcel on tour whose card has none', async () => {
      const access = accessOf('shuttle');
      const id = newId();
      const personId = await addPerson(db, finance);
      const parcel = newParcel({ status: 'en_route', personId });
      await statusOf(
        access,
        op('parcel', id, { ...parcel, departmentId: legal }),
      );
      const blank = await addPerson(db, null);
      await statusOf(access, op('parcel', id, { ...parcel, personId: blank }));
      expect((await storedParcel(id))?.departmentId).toBe(legal);
    });

    it.each([
      ['a tour', DEFAULT_OPERATING_PROFILE, null],
      ['a shuttle acting as department', SMALL_SITE_OPERATING_PROFILE, 'mail'],
    ] as const)(
      'with %s, the mail department catches a contact or not',
      async (_, profile, expected) => {
        const mail = await addDepartment(db, 'Service courrier');
        await writeOperatingProfile(sync, ORGANIZATION_ID, profile, AGENT_ID);
        const id = newId();
        await statusOf(
          accessOf('shuttle'),
          op(
            'parcel',
            id,
            newParcel({
              status: 'a_completer',
              contactId: await addContact(db),
            }),
          ),
        );
        expect((await storedParcel(id))?.departmentId).toBe(
          expected ? mail : null,
        );
        await db
          .update(schema.department)
          .set({ deletedAt: NOW })
          .where(eq(schema.department.id, mail));
      },
    );

    it('is required to be born on tour', async () => {
      const personId = await addPerson(db, null);
      expect(
        await statusOf(
          accessOf('shuttle'),
          op('parcel', newId(), newParcel({ status: 'en_route', personId })),
        ),
      ).toBe(409);
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

describe('sync.push of a shuttle on tour', () => {
  const other = OTHER_SHUTTLE_ID;
  const asShuttle: Access = { ...accessOf('shuttle'), onTour: true };

  it('writes its own parcels and new ones, not those of another tour', async () => {
    const mine = await addParcel({ receivedBy: AGENT_ID });
    const theirs = await addParcel({ receivedBy: other });
    const taken = await addParcel({
      receivedBy: other,
      tourShuttleId: AGENT_ID,
    });
    const created = newId();

    expect(
      await statusOf(asShuttle, op('parcel', mine, newParcel({ notes: 'x' }))),
    ).toBe(200);
    expect(
      await statusOf(asShuttle, op('parcel', taken, newParcel({ notes: 'x' }))),
    ).toBe(200);
    expect(
      await statusOf(
        asShuttle,
        op('parcel', created, newParcel({ receivedBy: other })),
      ),
    ).toBe(200);
    expect(
      await statusOf(
        asShuttle,
        op('parcel', theirs, newParcel({ notes: 'x' })),
      ),
    ).toBe(403);
    expect(
      await statusOf(
        { ...asShuttle, onTour: false },
        op('parcel', theirs, newParcel({ notes: 'x' })),
      ),
    ).toBe(200);

    const [row] = await db
      .select({ receivedBy: schema.parcel.receivedBy })
      .from(schema.parcel)
      .where(eq(schema.parcel.id, created));
    expect(row?.receivedBy).toBe(AGENT_ID);
  });

  it('cannot hand itself a parcel by a copy', async () => {
    const theirs = await addParcel({ receivedBy: other });
    const mine = await addParcel({ receivedBy: AGENT_ID });
    await statusOf(asShuttle, op('parcel', theirs, newParcel()));
    await statusOf(
      asShuttle,
      op(
        'parcel',
        mine,
        newParcel({ tourShuttleId: other, receivedBy: other }),
      ),
    );
    const rows = await db
      .select({
        id: schema.parcel.id,
        receivedBy: schema.parcel.receivedBy,
        tourShuttleId: schema.parcel.tourShuttleId,
      })
      .from(schema.parcel)
      .where(inArray(schema.parcel.id, [theirs, mine]));
    expect(rows.find(({ id }) => id === theirs)?.receivedBy).toBe(other);
    expect(rows.find(({ id }) => id === mine)).toMatchObject({
      receivedBy: AGENT_ID,
      tourShuttleId: null,
    });
  });

  it('refuses an event on a parcel of another tour', async () => {
    const theirs = await addParcel({ receivedBy: other });
    const event = op('event', newId(), {
      entity: PARCEL_EVENT_ENTITY,
      entityId: theirs,
      type: 'parcel.status',
      detail: {},
      agentId: AGENT_ID,
      at: NOW,
    });
    expect(await statusOf(asShuttle, event)).toBe(403);
  });
});

describe('whether a company runs tours', () => {
  it('reads the profile as the app does: only an explicit false', async () => {
    const company = OTHER_ORGANIZATION_ID;
    expect(await goesOnTour(sync, company)).toBe(false);
    await writeOperatingProfile(
      sync,
      company,
      SMALL_SITE_OPERATING_PROFILE,
      null,
    );
    expect(await goesOnTour(sync, company)).toBe(false);
    await writeOperatingProfile(sync, company, DEFAULT_OPERATING_PROFILE, null);
    expect(await goesOnTour(sync, company)).toBe(true);
  });
});
