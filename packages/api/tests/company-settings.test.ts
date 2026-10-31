import type { PGlite } from '@electric-sql/pglite';
import { RETENTION } from '@repo/contract/retention';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { retentionImpactOf, saveRetention } from '#features/company/retention';
import {
  readCompanySettings,
  writeCompanySettings,
} from '#features/company/settings';
import { runPurge } from '#features/maintenance/purge';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  OTHER_ORGANIZATION_ID,
  STRANGER_ID,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let db: TestDb;

const NOW = new Date('2026-10-27T03:00:00Z');
const monthsAgo = (months: number) => {
  const at = new Date(NOW);
  at.setUTCMonth(at.getUTCMonth() - months);
  return at;
};
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  ({ client, db } = await openTestDb());
}, 60_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.purge', 'on', true)`);
    await tx.delete(schema.event);
  });
  await db.delete(schema.handover);
  await db.delete(schema.parcel);
  await db.delete(schema.contact);
  await db.delete(schema.emailOutbox);
  await db.delete(schema.purgeRun);
  await db.delete(schema.companyLogo);
  await db.delete(schema.setting);
});

async function delivered(organizationId: string, at: Date) {
  const id = newId();
  const contactId = newId();
  await db.insert(schema.contact).values({
    id: contactId,
    organizationId,
    name: 'Camille Martin',
    nameNorm: 'camille martin',
    lastUsedAt: NOW,
  });
  await db.insert(schema.parcel).values({
    id,
    organizationId,
    status: 'remis',
    contactId,
    receivedAt: at,
    receivedBy: organizationId === ORGANIZATION_ID ? AGENT_ID : STRANGER_ID,
    deliveredAt: at,
    deliveredBy: organizationId === ORGANIZATION_ID ? AGENT_ID : STRANGER_ID,
    updatedAt: at,
    tracking: `T${id}`,
  } as typeof schema.parcel.$inferInsert);
  return id;
}

async function mail(
  organizationId: string | null,
  fields: Partial<typeof schema.emailOutbox.$inferInsert>,
) {
  const key = newId();
  await db.insert(schema.emailOutbox).values({
    idempotencyKey: key,
    organizationId,
    recipient: 'a@example.test',
    subject: 's',
    textBody: 't',
    ...fields,
  });
  return key;
}

const liveParcels = async () =>
  (
    await db
      .select({ id: schema.parcel.id })
      .from(schema.parcel)
      .where(isNull(schema.parcel.deletedAt))
  ).map((row) => row.id);

const purge = () => runPurge(asAnyDb(db), { now: NOW, trigger: 'auto' });

describe('purge by the durations of each company', () => {
  it('keeps what a company without a setting always kept', async () => {
    const kept = await delivered(ORGANIZATION_ID, monthsAgo(11));
    const gone = await delivered(ORGANIZATION_ID, monthsAgo(13));

    await purge();

    expect(await liveParcels()).toEqual([kept]);
    expect(await liveParcels()).not.toContain(gone);
    expect(RETENTION.parcel).toEqual({ amount: 12, unit: 'month' });
  });

  it('applies a shorter duration to its company and to no other', async () => {
    const other = await delivered(OTHER_ORGANIZATION_ID, monthsAgo(6));
    const mine = await delivered(ORGANIZATION_ID, monthsAgo(6));
    const recent = await delivered(ORGANIZATION_ID, monthsAgo(2));
    await writeCompanySettings(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { parcel: 3 } },
      AGENT_ID,
    );

    await purge();

    const live = await liveParcels();
    expect(live).toContain(other);
    expect(live).toContain(recent);
    expect(live).not.toContain(mine);
  });

  it('keeps longer when a company asked for longer', async () => {
    const kept = await delivered(ORGANIZATION_ID, monthsAgo(20));
    await writeCompanySettings(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { parcel: 24 } },
      AGENT_ID,
    );

    await purge();

    expect(await liveParcels()).toEqual([kept]);
  });

  it('falls back on the defaults when the stored value does not read', async () => {
    const kept = await delivered(ORGANIZATION_ID, monthsAgo(11));
    await writeCompanySettings(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { parcel: 0 } },
      AGENT_ID,
    );

    await purge();

    expect(await liveParcels()).toEqual([kept]);
  });

  it('erases the mails of each company by its own duration, orphan ones included', async () => {
    await writeCompanySettings(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { emailOutbox: 10 } },
      AGENT_ID,
    );
    const finished = { status: 'sent' as const, finishedAt: daysAgo(15) };
    await mail(ORGANIZATION_ID, finished);
    const other = await mail(OTHER_ORGANIZATION_ID, finished);
    const noCompany = await mail(null, finished);
    await mail(OTHER_ORGANIZATION_ID, {
      status: 'sending',
      leaseUntil: daysAgo(40),
    });
    const leased = await mail(OTHER_ORGANIZATION_ID, {
      status: 'sending',
      leaseUntil: daysAgo(1),
    });

    await purge();

    const keys = (await db.select().from(schema.emailOutbox)).map(
      (row) => row.idempotencyKey,
    );
    expect(keys.sort()).toEqual([other, noCompany, leased].sort());
  });
});

describe('announcing what lowering a duration takes', () => {
  it('announces exactly the parcels the purge then takes', async () => {
    await delivered(ORGANIZATION_ID, monthsAgo(6));
    await delivered(ORGANIZATION_ID, monthsAgo(5));
    await delivered(ORGANIZATION_ID, monthsAgo(1));
    await delivered(OTHER_ORGANIZATION_ID, monthsAgo(6));

    const impact = await retentionImpactOf(
      asAnyDb(db),
      ORGANIZATION_ID,
      { parcel: 3 },
      NOW,
    );
    expect(impact.parcels).toBe(2);

    await saveRetention(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { parcel: 3 }, announced: 2 },
      AGENT_ID,
      NOW,
    );
    await purge();

    const live = await db
      .select({ id: schema.parcel.id })
      .from(schema.parcel)
      .where(
        and(
          eq(schema.parcel.organizationId, ORGANIZATION_ID),
          isNull(schema.parcel.deletedAt),
        ),
      );
    expect(live).toHaveLength(1);
  });

  it('announces nothing when a duration goes up', async () => {
    await delivered(ORGANIZATION_ID, monthsAgo(13));
    expect(
      await retentionImpactOf(
        asAnyDb(db),
        ORGANIZATION_ID,
        { parcel: 24 },
        NOW,
      ),
    ).toMatchObject({ parcels: 0, deviceOnly: [] });
  });

  it('says what only the iPhones hold, without a figure', async () => {
    expect(
      (
        await retentionImpactOf(
          asAnyDb(db),
          ORGANIZATION_ID,
          { photo: 1, extraction: 2 },
          NOW,
        )
      ).deviceOnly,
    ).toEqual(['photo', 'extraction']);
  });

  it('announces again when more rows would go than announced, and saves nothing', async () => {
    await delivered(ORGANIZATION_ID, monthsAgo(6));
    const outcome = await saveRetention(
      asAnyDb(db),
      ORGANIZATION_ID,
      { retention: { parcel: 3 }, announced: 0 },
      AGENT_ID,
      NOW,
    );
    expect(outcome).toMatchObject({
      status: 'changed',
      impact: { parcels: 1 },
    });
    expect(
      (await readCompanySettings(asAnyDb(db), ORGANIZATION_ID)).retention,
    ).toBeUndefined();
  });

  it('refuses a signature kept longer than its parcel, and a duration out of bounds', async () => {
    const refused = (retention: object) =>
      saveRetention(
        asAnyDb(db),
        ORGANIZATION_ID,
        { retention, announced: 0 },
        AGENT_ID,
        NOW,
      );
    expect(await refused({ parcel: 6, signature: 12 })).toMatchObject({
      status: 'refused',
      problem: 'signatureOutlivesParcel',
    });
    expect(await refused({ emailOutbox: 1 })).toMatchObject({
      status: 'refused',
      problem: 'bounds',
    });
  });
});
