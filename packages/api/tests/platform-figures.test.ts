import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@repo/db/schema';
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

const { asAnyDb, AGENT_ID, ORGANIZATION_ID, OTHER_ORGANIZATION_ID, parcelRow } =
  await import('./helpers/pglite');
const { getPlatformOverview, listCompanies } =
  await import('#features/platform/service');

const NOW = new Date('2026-10-31T22:59:30Z');
const COMPANIES = 25;
const PARCELS = 868;

const parcelAt = (organizationId: string, at: string) => ({
  ...parcelRow(organizationId),
  receivedAt: new Date(at),
});

function eventAt(organizationId: string, at: string) {
  return {
    id: newId(),
    organizationId,
    entity: 'parcel',
    entityId: newId(),
    type: 'noted',
    actorId: AGENT_ID,
    at: new Date(at),
  };
}

let bulk: string[] = [];

beforeAll(async () => {
  bulk = Array.from({ length: COMPANIES - 2 }, () => newId());
  await db
    .insert(schema.organization)
    .values(bulk.map((id, i) => ({ id, name: `Client ${i}` })));
  await db.insert(schema.department).values([
    { id: newId(), organizationId: ORGANIZATION_ID, name: 'Finance' },
    { id: newId(), organizationId: ORGANIZATION_ID, name: 'Studio' },
    {
      id: newId(),
      organizationId: ORGANIZATION_ID,
      name: 'Archivé',
      deletedAt: new Date('2026-09-01T00:00:00Z'),
    },
  ]);
  await db.insert(schema.parcel).values([
    // Paris is UTC+2 until the 25th, then UTC+1: these two hang on the zone.
    parcelAt(ORGANIZATION_ID, '2026-09-30T21:59:00Z'),
    parcelAt(ORGANIZATION_ID, '2026-09-30T22:00:00Z'),
    parcelAt(ORGANIZATION_ID, '2026-10-20T08:00:00Z'),
    { ...parcelAt(ORGANIZATION_ID, '2026-10-21T08:00:00Z'), deletedAt: NOW },
    parcelAt(ORGANIZATION_ID, '2026-10-22T08:00:00Z'),
    parcelAt(ORGANIZATION_ID, '2026-10-31T22:59:00Z'),
    parcelAt(ORGANIZATION_ID, '2026-10-31T23:00:00Z'),
  ]);
  await db.insert(schema.event).values([
    eventAt(ORGANIZATION_ID, '2026-10-31T22:59:10Z'),
    eventAt(ORGANIZATION_ID, '2027-01-01T10:00:00Z'),
  ]);
  const rest = PARCELS - 7;
  await db.insert(schema.parcel).values(
    Array.from({ length: rest }, (_, i) =>
      parcelAt(OTHER_ORGANIZATION_ID, `2026-10-0${(i % 9) + 1}T08:00:00Z`),
    ),
  );
});

afterAll(async () => {
  await client.close();
});

describe('the figures, on a known set', () => {
  it('counts a month in Paris time, without deleted parcels', async () => {
    const companies = await listCompanies(asAnyDb(db), NOW);
    const first = companies.find((row) => row.id === ORGANIZATION_ID);
    // 30/09 22:00Z, 20/10, 22/10, 31/10 22:59Z; 31/10 23:00Z is ahead of now.
    expect(first?.parcelsThisMonth).toBe(4);
    expect(first?.departments).toBe(2);
    expect(first?.accounts).toBe(1);
  });

  it('dates the last activity from events and parcels, never after now', async () => {
    const companies = await listCompanies(asAnyDb(db), NOW);
    const first = companies.find((row) => row.id === ORGANIZATION_ID);
    expect(first?.lastActivityAt).toEqual(new Date('2026-10-31T22:59:10Z'));
    const other = companies.find((row) => row.id === OTHER_ORGANIZATION_ID);
    expect(other?.lastActivityAt).toEqual(new Date('2026-10-09T08:00:00Z'));
  });

  it('leaves a company with nothing at zero, undated', async () => {
    const companies = await listCompanies(asAnyDb(db), NOW);
    expect(companies).toHaveLength(COMPANIES);
    const empty = companies.find((row) => row.id === bulk[0]);
    expect(empty).toMatchObject({
      parcelsThisMonth: 0,
      lastActivityAt: null,
      accounts: 0,
      departments: 0,
    });
  });

  it('adds up to the same totals in the overview', async () => {
    const companies = await listCompanies(asAnyDb(db), NOW);
    const overview = await getPlatformOverview(asAnyDb(db), NOW);
    expect(overview).toEqual({
      companies: COMPANIES,
      suspendedCompanies: 0,
      accounts: 2,
      departments: 2,
      parcelsThisMonth: 4 + (PARCELS - 7),
    });
    expect(companies.reduce((sum, row) => sum + row.parcelsThisMonth, 0)).toBe(
      overview.parcelsThisMonth,
    );
  });
});
