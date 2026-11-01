import 'fake-indexeddb/auto';
import type { Session } from '@repo/auth';
import { newPickupToken } from '@repo/contract/pickup';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import {
  OPERATING_PROFILE_KEY,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
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
const { cancelHandover } = await import('#/features/handover/cancel-handover');
const { settleDeliveryConflicts } =
  await import('#/features/handover/conflicts');
const { lookupPickupPin, lookupPickupText } =
  await import('#/features/handover/pickup-lookup');
const { recordHandover } = await import('#/features/handover/record-handover');
const { addHandoverProof } = await import('#/features/handover/proofs');
const { MemoryFiles } = await import('./helpers/memory-files');
const { searchForCode } = await import('#/features/handover/route');
const { listHomeParcels } = await import('#/features/parcels/api/use-parcels');
const { loadParcelRecord } =
  await import('#/features/parcels/api/parcel-record');
const { describeRecord } = await import('#/features/parcels/record');
const { createTranslator, DEFAULT_LOCALE } = await import('@repo/shared/i18n');
const { createSyncEngine } = await import('#/features/sync/engine');
const { mergeContact } = await import('#/features/directory/contacts');
const { contactRow, openTestDatabase, parcelRow, personRow, pickupCodeRow } =
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
// The desk of these iPhones: the shuttle hands over, as on a converted site.
await server.insert(schema.setting).values({
  id: newId(),
  organizationId: ORGANIZATION_ID,
  key: OPERATING_PROFILE_KEY,
  value: SMALL_SITE_OPERATING_PROFILE,
});

afterAll(async () => {
  await client.close();
});

function sessionOf(userId: string, role = 'shuttle'): Session {
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
      role,
      banned: false,
    },
  };
}

function apiOf(userId: string, role?: string) {
  return appRouter.createCaller(
    createTRPCContext({
      headers: new Headers({ cookie: 'session=abc' }),
      session: sessionOf(userId, role),
    }),
  );
}

/** An iPhone of the mailroom: its own base, its engine, the real router. */
function iphone(db: Db, userId: string, role?: string) {
  const api = apiOf(userId, role);
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
  // The directory is written by others: the shuttle only reads it.
  await server
    .insert(schema.directoryPerson)
    .values({ ...nora, organizationId: ORGANIZATION_ID });
  await first.table('directory_person').put(nora);
  await commitLocal(first, {
    upserts: parcels.map((row) => ({ entity: 'parcel' as const, row })),
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
        delegateName: 'Paul Mercier',
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
      delegateName: 'Paul Mercier',
      agentName: 'Karim Benali',
      cancelledAt: null,
    });

    await other.syncNow({ force: true });
    expect(await second.handover.get(done.handoverId)).toMatchObject({
      agentName: 'Karim Benali',
      delegateName: 'Paul Mercier',
    });
    expect((await second.parcel.get(parcels[1]!.id))?.status).toBe('remis');
    expect((await second.pickupCode.get(match.code.id))?.usedAt).not.toBeNull();
    const rows = await listHomeParcels(second);
    expect(rows.map((row) => row.status)).toEqual([
      expect.stringMatching(/^Remis à .*, QR vérifié$/),
      expect.stringMatching(/^Remis à .*, QR vérifié$/),
    ]);
  });

  it('carries the signature and photo flags to the other iPhone, never the files', async () => {
    const files = new MemoryFiles();
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });

    const done = await recordHandover(
      first,
      {
        kind: 'person',
        id: nora.id,
        via: 'manuel',
        at: Date.now(),
        parcelIds: parcels.map((parcel) => parcel.id),
      },
      {
        agentId: KARIM,
        agentName: 'Karim Benali',
        signature: {
          proof: {
            kind: 'signature',
            blob: new Blob(['png']),
            width: 9,
            height: 9,
          },
          files,
        },
      },
    );
    await desk.syncNow({ force: true });
    await addHandoverProof(first, files, done.handoverId, {
      kind: 'photo',
      blob: new Blob(['jpg']),
      width: 9,
      height: 9,
    });
    const run = await desk.syncNow({ force: true });

    expect(run).toMatchObject({ status: 'idle', rejected: 0 });
    const [handover] = await server
      .select()
      .from(schema.handover)
      .where(eq(schema.handover.id, done.handoverId));
    expect(handover).toMatchObject({
      method: 'signature',
      hasSignature: true,
      hasPhoto: true,
    });
    await other.syncNow({ force: true });
    expect(await second.handover.get(done.handoverId)).toMatchObject({
      method: 'signature',
      hasSignature: true,
      hasPhoto: true,
    });
    expect(await second.handoverProof.count()).toBe(0);
  });

  it('settles a signed handover that another iPhone beat, its signature kept here', async () => {
    const files = new MemoryFiles();
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });
    const search = () => ({
      kind: 'person' as const,
      id: nora.id,
      via: 'manuel' as const,
      at: Date.now(),
      parcelIds: parcels.map((parcel) => parcel.id),
    });

    await recordHandover(first, search(), {
      agentId: KARIM,
      agentName: 'Karim Benali',
    });
    await desk.syncNow({ force: true });
    const lost = await recordHandover(second, search(), {
      agentId: LINA,
      agentName: NAMES[LINA]!,
      signature: {
        proof: {
          kind: 'signature',
          blob: new Blob(['png']),
          width: 9,
          height: 9,
        },
        files,
      },
    });
    const run = await other.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 2 });
    const settled = await second.handover.get(lost.handoverId);
    expect(settled).toMatchObject({ method: 'signature', hasSignature: true });
    expect(settled?.cancelledAt).toBeInstanceOf(Date);
    await expect(
      addHandoverProof(second, files, lost.handoverId, {
        kind: 'photo',
        blob: new Blob(['jpg']),
        width: 9,
        height: 9,
      }),
    ).rejects.toMatchObject({ reason: 'cancelled' });
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

describe('a handover undone between two iPhones (F44)', () => {
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
      { agentId, agentName: agentId },
    );

  it('reaches the server and the other iPhone with its reason', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    const done = await handOver(first, KARIM);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });

    await cancelHandover(
      second,
      done.handoverId,
      { reason: 'wrong_person', note: 'Homonyme' },
      { agentId: LINA, agentName: 'Lina' },
    );
    const run = await other.syncNow({ force: true });
    await desk.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 0 });
    expect((await serverParcel(parcels[0]!.id))?.status).toBe('recu');
    expect(await first.handover.get(done.handoverId)).toMatchObject({
      cancelReason: 'wrong_person',
      cancelNote: 'Homonyme',
      cancelledByName: 'Lina',
    });
    expect((await first.parcel.get(parcels[1]!.id))?.status).toBe('recu');
  });

  it('goes through when undone before the handover ever left', async () => {
    const desk = iphone(first, KARIM);
    await desk.syncNow({ force: true });
    const done = await handOver(first, KARIM);

    await cancelHandover(
      first,
      done.handoverId,
      { reason: 'entry_error' },
      { agentId: KARIM },
    );
    const run = await desk.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 0 });
    expect(await first.outbox.count()).toBe(0);
    expect((await serverParcel(parcels[0]!.id))?.status).toBe('recu');
  });

  it('settles two iPhones undoing the same handover, the first reason kept', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    const done = await handOver(first, KARIM);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });

    await cancelHandover(
      first,
      done.handoverId,
      { reason: 'wrong_parcel' },
      { agentId: KARIM },
    );
    await cancelHandover(
      second,
      done.handoverId,
      { reason: 'entry_error' },
      { agentId: LINA },
    );
    await desk.syncNow({ force: true });
    const run = await other.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 0 });
    expect(await second.outbox.count()).toBe(0);
    expect((await second.handover.get(done.handoverId))?.cancelReason).toBe(
      'wrong_parcel',
    );
  });

  it('lets the parcels be handed over again', async () => {
    const desk = iphone(first, KARIM);
    await desk.syncNow({ force: true });
    const done = await handOver(first, KARIM);
    await desk.syncNow({ force: true });
    await cancelHandover(
      first,
      done.handoverId,
      { reason: 'wrong_person' },
      { agentId: KARIM },
    );
    await desk.syncNow({ force: true });

    const again = await handOver(first, KARIM);
    const run = await desk.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 0 });
    expect(again.handoverId).not.toBe(done.handoverId);
    expect((await serverParcel(parcels[0]!.id))?.status).toBe('remis');
  });

  it('undoes the winner of a parcel despite the handover that lost it', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });
    const lostOne = parcels[0]!.id;
    const keptOne = parcels[1]!.id;
    const person = {
      kind: 'person' as const,
      id: nora.id,
      via: 'manuel' as const,
      at: Date.now(),
    };
    const winner = await recordHandover(
      first,
      { ...person, parcelIds: [lostOne] },
      { agentId: KARIM },
    );
    await desk.syncNow({ force: true });
    await recordHandover(
      second,
      { ...person, parcelIds: [lostOne, keptOne] },
      { agentId: LINA },
    );
    await other.syncNow({ force: true });
    await desk.syncNow({ force: true });

    await cancelHandover(
      first,
      winner.handoverId,
      { reason: 'wrong_parcel' },
      { agentId: KARIM },
    );
    const run = await desk.syncNow({ force: true });

    expect(run).toMatchObject({ rejected: 0 });
    expect((await serverParcel(lostOne))?.status).toBe('recu');
    expect((await serverParcel(keptOne))?.status).toBe('remis');
  });
});

describe('a handover at a department', () => {
  it('goes from the offline counter to the server, with its journal, on the code of its department', async () => {
    const finance = newId();
    const clerk = `clerk-${newId()}`;
    await server
      .insert(schema.department)
      .values({
        id: finance,
        organizationId: ORGANIZATION_ID,
        name: 'Finance',
      });
    await server.insert(schema.user).values({
      id: clerk,
      name: 'Inès',
      email: `${clerk}@example.test`,
    });
    await server
      .insert(schema.organizationMember)
      .values({ userId: clerk, organizationId: ORGANIZATION_ID });
    await server.insert(schema.departmentMember).values({
      userId: clerk,
      departmentId: finance,
      organizationId: ORGANIZATION_ID,
    });
    await server
      .update(schema.directoryPerson)
      .set({ departmentId: finance })
      .where(eq(schema.directoryPerson.id, nora.id));
    await iphone(first, KARIM).syncNow({ force: true });
    const token = newPickupToken();
    const code = await pickupCodeRow(
      { personId: nora.id, departmentId: finance },
      { token, now: new Date() },
    );
    await server
      .insert(schema.pickupCode)
      .values({ ...code, organizationId: ORGANIZATION_ID });
    const counter = await openTestDatabase();
    const desk = iphone(counter, clerk, 'department');
    await desk.syncNow({ force: true });

    const match = await lookupPickupText(counter, token);
    if (match.status !== 'active') throw new Error(match.status);
    const done = await recordHandover(
      counter,
      {
        ...searchForCode(match.code, 'qr', Date.now()),
        parcelIds: parcels.map((parcel) => parcel.id),
      },
      { agentId: clerk, agentName: 'Inès' },
    );
    await desk.syncNow({ force: true });

    expect((await serverParcel(parcels[0]!.id))?.status).toBe('remis');
    const [row] = await server
      .select()
      .from(schema.handover)
      .where(eq(schema.handover.id, done.handoverId));
    expect(row?.parcelIds).toHaveLength(2);
    const events = await server
      .select()
      .from(schema.event)
      .where(eq(schema.event.entityId, parcels[0]!.id));
    expect(events.map((event) => event.type)).toContain('parcel.delivered');
  });
});

describe('a pickup code between two iPhones (F41)', () => {
  const issue = async (pin = '4821') => {
    const token = newPickupToken();
    const code = await pickupCodeRow(
      { personId: nora.id },
      { token, pin, now: new Date() },
    );
    await commitLocal(first, {
      upserts: [{ entity: 'pickup_code', row: code }],
    });
    return { token, code };
  };

  it('reaches the other iPhone at its next sync, or at once by pickup.verify', async () => {
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await other.syncNow({ force: true });
    const { token, code } = await issue();
    await desk.syncNow({ force: true });

    expect((await lookupPickupText(second, token)).status).toBe('unknown');
    const api = apiOf(LINA);
    const match = await lookupPickupText(second, token, new Date(), {
      online: () => true,
      verify: (input) => api.pickup.verify(input),
      sync: () => other.syncNow({ force: true }),
    });

    expect(match).toMatchObject({ status: 'active', code: { id: code.id } });
    expect((await lookupPickupPin(second, '4821')).status).toBe('active');
  });

  it('is refused after use, offline too, and keeps the first use once both are back', async () => {
    const { token } = await issue();
    const desk = iphone(first, KARIM);
    const other = iphone(second, LINA);
    await desk.syncNow({ force: true });
    await other.syncNow({ force: true });
    const handOver = async (db: Db, agentId: string, now: Date) => {
      const match = await lookupPickupText(db, token, now);
      if (match.status !== 'active') throw new Error(match.status);
      return recordHandover(
        db,
        {
          ...searchForCode(match.code, 'qr', now.getTime()),
          parcelIds: parcels.map((parcel) => parcel.id),
        },
        { agentId, now },
      );
    };
    const firstUse = new Date(Date.now() + 60_000);
    const secondUse = new Date(Date.now() + 120_000);

    await handOver(first, KARIM, firstUse);
    expect((await lookupPickupText(first, token, firstUse)).status).toBe(
      'used',
    );
    const lost = await handOver(second, LINA, secondUse);
    await desk.syncNow({ force: true });
    const run = await other.syncNow({ force: true });

    expect(run.rejected).toBe(2);
    const [onServer] = await server
      .select()
      .from(schema.pickupCode)
      .where(eq(schema.pickupCode.personId, nora.id));
    expect(onServer?.usedAt).toEqual(firstUse);
    const local = await second.pickupCode.get(onServer!.id);
    expect(local?.usedAt).toEqual(firstUse);
    expect((await lookupPickupText(second, token)).status).toBe('used');
    expect(
      (await second.handover.get(lost.handoverId))?.cancelledAt,
    ).not.toBeNull();
    expect(conflicts).toEqual([
      { recipientName: 'Nora Haddad', byMe: false, count: 2 },
    ]);
  });

  it('moves a merged contact’s code to the person on the server, one open code left', async () => {
    const desk = iphone(first, KARIM);
    const outside = contactRow({ name: 'Nora H.', nameNorm: 'nora h' });
    const token = newPickupToken();
    const older = await pickupCodeRow(
      { personId: nora.id },
      { pin: '1111', now: new Date(Date.now() - 60_000) },
    );
    const latest = await pickupCodeRow(
      { contactId: outside.id },
      { token, pin: '2222', now: new Date() },
    );
    await commitLocal(first, {
      upserts: [
        { entity: 'contact', row: outside },
        { entity: 'pickup_code', row: older },
        { entity: 'pickup_code', row: latest },
      ],
    });
    await desk.syncNow({ force: true });

    await mergeContact(first, outside.id, nora.id, { agentId: KARIM });
    const run = await desk.syncNow({ force: true });
    const open = (
      await server
        .select()
        .from(schema.pickupCode)
        .where(eq(schema.pickupCode.personId, nora.id))
    ).filter((row) => !row.deletedAt && !row.usedAt);

    expect(run).toMatchObject({ status: 'idle', rejected: 0 });
    expect(open.map((row) => row.id)).toEqual([latest.id]);
    expect((await lookupPickupText(first, token)).status).toBe('active');
  });
});
