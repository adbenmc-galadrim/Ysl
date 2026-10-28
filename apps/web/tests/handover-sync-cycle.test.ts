import 'fake-indexeddb/auto';
import type { Session } from '@repo/auth';
import { newPickupToken } from '@repo/contract/pickup';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { client, server } = await vi.hoisted(async () => {
  const { fileURLToPath } = await import('node:url');
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const tables = await import('@repo/db/schema');
  const client = new PGlite();
  const server = drizzle({ client, schema: tables });
  await migrate(server, {
    migrationsFolder: fileURLToPath(
      new URL('../../../packages/db/drizzle', import.meta.url),
    ),
  });
  return { client, server };
});

vi.mock('@repo/db', () => ({ db: server, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { appRouter, createTRPCContext } = await import('@repo/api');
const { commitLocal } = await import('#/features/db/commit');
const { settleDeliveryConflicts } =
  await import('#/features/handover/conflicts');
const { lookupPickupText } = await import('#/features/handover/pickup-lookup');
const { recordHandover } = await import('#/features/handover/record-handover');
const { searchForCode } = await import('#/features/handover/route');
const { listHomeParcels } = await import('#/features/parcels/api/use-parcels');
const { loadParcelRecord } =
  await import('#/features/parcels/api/parcel-record');
const { describeRecord } = await import('#/features/parcels/record');
const { createTranslator, DEFAULT_LOCALE } = await import('@repo/shared/i18n');
const { createSyncEngine } = await import('#/features/sync/engine');
const { openTestDatabase, parcelRow, personRow, pickupCodeRow } =
  await import('./helpers/local-rows');

type Db = Awaited<ReturnType<typeof openTestDatabase>>;

const ORGANIZATION_ID = newId();
const KARIM = 'agent-karim';
const LINA = 'agent-lina';
const NAMES: Record<string, string> = {
  [KARIM]: 'Karim Benali',
  [LINA]: 'Lina Morel',
};

await server
  .insert(schema.organization)
  .values({ id: ORGANIZATION_ID, name: 'Service courrier' });
await server.insert(schema.user).values([
  { id: KARIM, name: 'Karim', email: 'karim@example.test' },
  { id: LINA, name: 'Lina', email: 'lina@example.test' },
]);
await server.insert(schema.organizationMember).values([
  { userId: KARIM, organizationId: ORGANIZATION_ID },
  { userId: LINA, organizationId: ORGANIZATION_ID },
]);

afterAll(async () => {
  await client.close();
});

function sessionOf(userId: string): Session {
  const now = new Date();
  return {
    session: {
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
    },
    user: {
      id: userId,
      name: userId,
      email: `${userId}@example.test`,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      role: 'agent',
      banned: false,
    },
  };
}

/** An iPhone of the mailroom: its own base, its engine, the real router. */
function iphone(db: Db, userId: string) {
  const api = appRouter.createCaller(
    createTRPCContext({
      headers: new Headers({ cookie: 'session=abc' }),
      session: sessionOf(userId),
    }),
  );
  return createSyncEngine({
    db,
    push: (input) => api.sync.push(input),
    pull: (input) => api.sync.pull(input),
    online: () => true,
    afterPull: async () => {
      conflicts.push(...(await settleDeliveryConflicts(db)));
    },
  });
}

let conflicts: Awaited<ReturnType<typeof settleDeliveryConflicts>> = [];
let first: Db;
let second: Db;
let nora: ReturnType<typeof personRow>;
let parcels: ReturnType<typeof parcelRow>[];

beforeEach(async () => {
  conflicts = [];
  first = await openTestDatabase();
  second = await openTestDatabase();
  nora = personRow({
    firstName: 'Nora',
    lastName: 'Haddad',
    nameNorm: 'nora haddad',
    email: `nora.${newId()}@example.test`,
  });
  parcels = [
    parcelRow({ personId: nora.id, receivedBy: KARIM }),
    parcelRow({ personId: nora.id, receivedBy: KARIM }),
  ];
  await commitLocal(first, {
    upserts: [
      { entity: 'directory_person', row: nora },
      ...parcels.map((row) => ({ entity: 'parcel' as const, row })),
    ],
  });
});

const serverParcel = async (id: string) =>
  (
    await server.select().from(schema.parcel).where(eq(schema.parcel.id, id))
  )[0];

describe('a handover between two iPhones', () => {
  it('goes from the desk to the server, then to the other iPhone', async () => {
    const token = newPickupToken();
    await commitLocal(first, {
      upserts: [
        {
          entity: 'pickup_code',
          row: await pickupCodeRow(
            { personId: nora.id },
            { token, now: new Date() },
          ),
        },
      ],
    });
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });

    const match = await lookupPickupText(first, token);
    if (match.status !== 'active') throw new Error(match.status);
    const done = await recordHandover(
      first,
      {
        ...searchForCode(match.code, 'qr', Date.now()),
        parcelIds: parcels.map((parcel) => parcel.id),
      },
      { agentId: KARIM, agentName: 'Karim Benali' },
    );
    const run = await desk.syncNow({ force: true });

    expect(run).toMatchObject({ status: 'idle', rejected: 0 });
    expect(await first.outbox.count()).toBe(0);
    expect(await serverParcel(parcels[0]!.id)).toMatchObject({
      status: 'remis',
      deliveredBy: KARIM,
    });
    const [handover] = await server
      .select()
      .from(schema.handover)
      .where(eq(schema.handover.id, done.handoverId));
    expect(handover).toMatchObject({
      method: 'qr',
      personId: nora.id,
      recipientName: 'Nora Haddad',
      agentName: 'Karim Benali',
      cancelledAt: null,
    });

    await other.syncNow({ force: true });
    expect((await second.handover.get(done.handoverId))?.agentName).toBe(
      'Karim Benali',
    );
    expect((await second.parcel.get(parcels[1]!.id))?.status).toBe('remis');
    expect((await second.pickupCode.get(match.code.id))?.usedAt).not.toBeNull();
    const rows = await listHomeParcels(second);
    expect(rows.map((row) => row.status)).toEqual([
      expect.stringMatching(/^Remis à .*, QR vérifié$/),
      expect.stringMatching(/^Remis à .*, QR vérifié$/),
    ]);
  });

  it('settles a parcel another iPhone handed over first', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });
    const handOver = (db: Db, agentId: string) =>
      recordHandover(
        db,
        {
          kind: 'person',
          id: nora.id,
          via: 'manuel',
          at: Date.now(),
          parcelIds: parcels.map((parcel) => parcel.id),
        },
        { agentId, agentName: NAMES[agentId]! },
      );

    await handOver(first, KARIM);
    await desk.syncNow({ force: true });
    const lost = await handOver(second, LINA);
    const run = await other.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 2 });
    expect(conflicts).toEqual([
      { recipientName: 'Nora Haddad', byMe: false, count: 2 },
    ]);
    expect(await second.parcel.get(parcels[0]!.id)).toMatchObject({
      status: 'remis',
      deliveredBy: KARIM,
    });
    expect(await second.outbox.where('state').equals('rejected').count()).toBe(
      0,
    );
    expect(
      (await second.handover.get(lost.handoverId))?.cancelledAt,
    ).not.toBeNull();

    await other.syncNow({ force: true });
    const [cancelled] = await server
      .select()
      .from(schema.handover)
      .where(eq(schema.handover.id, lost.handoverId));
    expect(cancelled?.cancelledAt).not.toBeNull();
    expect(await second.outbox.count()).toBe(0);
    expect((await serverParcel(parcels[1]!.id))?.deliveredBy).toBe(KARIM);
  });

  it('keeps a handover that lost one parcel of two, and tells each parcel’s own', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });
    const [beaten, kept] = parcels.map((parcel) => parcel.id) as [
      string,
      string,
    ];
    const handOver = (db: Db, agentId: string, parcelIds: string[]) =>
      recordHandover(
        db,
        {
          kind: 'person',
          id: nora.id,
          via: 'manuel',
          at: Date.now(),
          parcelIds,
        },
        { agentId, agentName: NAMES[agentId]! },
      );

    await handOver(first, KARIM, [beaten]);
    await desk.syncNow({ force: true });
    const partial = await handOver(second, LINA, [beaten, kept]);
    await other.syncNow({ force: true });

    expect(conflicts).toEqual([
      { recipientName: 'Nora Haddad', byMe: false, count: 1 },
    ]);
    expect(
      (await second.handover.get(partial.handoverId))?.cancelledAt,
    ).toBeNull();
    expect((await serverParcel(kept))?.deliveredBy).toBe(LINA);
    const t = createTranslator(DEFAULT_LOCALE);
    const record = await loadParcelRecord(second, beaten);
    expect(record?.handover?.agentId).toBe(KARIM);
    const titles = describeRecord(record!, {
      now: new Date(),
      t,
      showUnsent: true,
    }).history?.map((entry) => entry.title);
    expect(
      titles?.filter(
        (title) => typeof title === 'string' && title.startsWith('Remis'),
      ),
    ).toEqual(['Remis à Nora Haddad par Karim (sans vérification)']);
  });
});
