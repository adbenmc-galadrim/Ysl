import type { Session } from '@repo/auth/client';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
import { setting } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

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
const { AGENT_ID, parcelRow, STRANGER_ID } = await import('./helpers/pglite');
const { parcel } = await import('@repo/db/schema');

afterAll(async () => {
  await client.close();
});

function sessionOf(userId: string): Session {
  const base = sessionFor('company_admin');
  return {
    session: { ...base.session, userId },
    user: { ...base.user, id: userId },
  };
}

const admin = () => callerFor(sessionOf(AGENT_ID));
const rows = () =>
  db.select().from(setting).where(eq(setting.key, OPERATING_PROFILE_KEY));

describe('the operating profile', () => {
  it('reads the default for a company with none, and writes nothing', async () => {
    const { profile } = await admin().operating.get();
    expect(profile).toEqual(DEFAULT_OPERATING_PROFILE);
    expect(await rows()).toEqual([]);
  });

  it('names no starting model for a company from before the models', async () => {
    expect(await admin().operating.get()).toMatchObject({ profileModel: null });
  });

  it('saving the same profile writes nothing', async () => {
    const saved = await admin().operating.save({
      profile: DEFAULT_OPERATING_PROFILE,
    });
    expect(saved.applied).toBe(0);
    expect(await rows()).toEqual([]);
  });

  it('counts the parcels under way, and applies a change to them', async () => {
    await db.insert(parcel).values([
      { ...parcelRow(), status: 'recu' },
      { ...parcelRow(), status: 'recu' },
      { ...parcelRow(), status: 'a_completer' },
    ]);
    const { counts } = await admin().operating.get();
    expect(counts).toMatchObject({ recu: 2, a_completer: 1 });

    const saved = await admin().operating.save({
      profile: { ...DEFAULT_OPERATING_PROFILE, signature: 'required' },
    });
    expect(saved.applied).toBe(2);
    expect((await admin().operating.get()).profile.signature).toBe('required');
  });

  it('keeps one row per company, stamped for the devices to pull', async () => {
    const before = await rows();
    await admin().operating.save({ profile: SMALL_SITE_OPERATING_PROFILE });
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(before[0]?.id);
    expect(stored[0]).toMatchObject({
      updatedBy: AGENT_ID,
      value: SMALL_SITE_OPERATING_PROFILE,
    });
    expect(stored[0]?.serverXid).toBeGreaterThan(before[0]?.serverXid ?? 0);
  });

  it('leaves the other companies alone', async () => {
    const other = callerFor(sessionOf(STRANGER_ID));
    expect((await other.operating.get()).profile).toEqual(
      DEFAULT_OPERATING_PROFILE,
    );
    await other.operating.save({
      profile: { ...DEFAULT_OPERATING_PROFILE, photo: 'disabled' },
    });
    expect((await admin().operating.get()).profile).toEqual(
      SMALL_SITE_OPERATING_PROFILE,
    );
  });

  it('refuses a profile with a value it does not know', async () => {
    await expect(
      admin().operating.save({
        profile: { ...DEFAULT_OPERATING_PROFILE, photo: 'maybe' as 'required' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
