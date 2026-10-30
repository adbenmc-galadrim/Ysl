import type { PGlite } from '@electric-sql/pglite';
import { cutoff, RETENTION } from '@repo/contract/retention';
import { emailOutbox } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPurge } from '#features/maintenance/purge';
import type { EmailMessage, SendResult } from '#features/mail/mailer';
import {
  BLOCKED_DELAY_MS,
  drainEmailOutbox,
  enqueueEmail,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
} from '#features/mail/queue';
import { asAnyDb, openTestDb, type TestDb } from './helpers/pglite';

let client: PGlite;
let testDb: TestDb;

const T0 = new Date('2026-10-30T08:00:00Z');
const after = (ms: number) => new Date(T0.getTime() + ms);

function scripted(...results: (SendResult | Error)[]) {
  const seen: EmailMessage[] = [];
  return {
    seen,
    send: (message: EmailMessage) => {
      seen.push(message);
      const next = results.shift() ?? {
        status: 'sent' as const,
        providerMessageId: 'id',
      };
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    },
  };
}

const message = (key = 'invite:1') => ({
  idempotencyKey: key,
  to: 'camille@example.test',
  subject: 'Invitation',
  text: 'Bonjour',
});

const rowOf = async (key = 'invite:1') => {
  const [row] = await testDb
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.idempotencyKey, key));
  return row;
};

beforeAll(async () => {
  ({ client, db: testDb } = await openTestDb());
}, 60_000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await testDb.delete(emailOutbox);
  await enqueueEmail(asAnyDb(testDb), message());
  await testDb.update(emailOutbox).set({ nextAttemptAt: T0 });
});

describe('email queue', () => {
  it('keeps one row when the same message is queued twice', async () => {
    const again = await enqueueEmail(asAnyDb(testDb), message());
    expect(again.created).toBe(false);
    expect(await testDb.select().from(emailOutbox)).toHaveLength(1);
  });

  it('survives an outage: waits, retries with the same key, sends once', async () => {
    const mailer = scripted(
      { status: 'retry', reason: 'brevo 503' },
      new TypeError('fetch failed'),
    );
    const db = asAnyDb(testDb);

    expect(await drainEmailOutbox(db, mailer, { now: () => T0 })).toEqual({
      sent: 0,
      retry: 1,
      blocked: 0,
      failed: 0,
    });
    expect((await rowOf())?.lastError).toBe('brevo 503');

    const tooEarly = after((RETRY_DELAYS_MS[0] ?? 0) - 1);
    await drainEmailOutbox(db, mailer, { now: () => tooEarly });
    expect(mailer.seen).toHaveLength(1);

    const second = after(RETRY_DELAYS_MS[0] ?? 0);
    await drainEmailOutbox(db, mailer, { now: () => second });
    expect((await rowOf())?.lastError).toBe('TypeError');

    const third = after((RETRY_DELAYS_MS[0] ?? 0) + (RETRY_DELAYS_MS[1] ?? 0));
    await drainEmailOutbox(db, mailer, { now: () => third });
    await drainEmailOutbox(db, mailer, { now: () => after(99 * 3_600_000) });

    expect(mailer.seen.map((m) => m.idempotencyKey)).toEqual([
      'invite:1',
      'invite:1',
      'invite:1',
    ]);
    expect(await rowOf()).toMatchObject({
      status: 'sent',
      attempts: 3,
      lastError: null,
    });
  });

  it('honours a longer wait asked by the provider', async () => {
    const mailer = scripted({
      status: 'retry',
      reason: 'brevo 429',
      retryAfterMs: 3_600_000,
    });
    await drainEmailOutbox(asAnyDb(testDb), mailer, { now: () => T0 });
    expect((await rowOf())?.nextAttemptAt).toEqual(after(3_600_000));
  });

  it('takes a row back when its worker died, and fails it at the last attempt', async () => {
    const db = asAnyDb(testDb);
    await testDb
      .update(emailOutbox)
      .set({ status: 'sending', attempts: 1, leaseUntil: after(1_000) });
    const mailer = scripted();

    await drainEmailOutbox(db, mailer, { now: () => T0 });
    expect(mailer.seen).toHaveLength(0);

    await drainEmailOutbox(db, mailer, { now: () => after(1_000) });
    expect(mailer.seen).toHaveLength(1);
    expect((await rowOf())?.status).toBe('sent');

    await enqueueEmail(db, message('invite:2'));
    await testDb
      .update(emailOutbox)
      .set({
        status: 'sending',
        attempts: MAX_ATTEMPTS,
        leaseUntil: after(1_000),
      })
      .where(eq(emailOutbox.idempotencyKey, 'invite:2'));
    await drainEmailOutbox(db, mailer, { now: () => after(2_000) });
    expect((await rowOf('invite:2'))?.status).toBe('failed');
  });

  it('sends each message once when two drains interleave', async () => {
    const db = asAnyDb(testDb);
    await enqueueEmail(db, message('invite:2'));
    await testDb.update(emailOutbox).set({ nextAttemptAt: T0 });
    const mailer = scripted();

    await Promise.all([
      drainEmailOutbox(db, mailer, { now: () => T0 }),
      drainEmailOutbox(db, mailer, { now: () => T0 }),
    ]);

    expect(mailer.seen.map((m) => m.idempotencyKey).sort()).toEqual([
      'invite:1',
      'invite:2',
    ]);
  });

  it('stops at a rejection, and after the last attempt', async () => {
    const db = asAnyDb(testDb);
    const rejecting = scripted({ status: 'rejected', reason: 'brevo 400' });
    await drainEmailOutbox(db, rejecting, { now: () => T0 });
    await drainEmailOutbox(db, rejecting, { now: () => after(99 * 3_600_000) });
    expect(rejecting.seen).toHaveLength(1);
    expect(await rowOf()).toMatchObject({
      status: 'failed',
      lastError: 'brevo 400',
    });

    await enqueueEmail(db, message('invite:2'));
    await testDb
      .update(emailOutbox)
      .set({ attempts: MAX_ATTEMPTS - 1, nextAttemptAt: T0 })
      .where(eq(emailOutbox.idempotencyKey, 'invite:2'));
    await drainEmailOutbox(
      db,
      scripted({ status: 'retry', reason: 'brevo 503' }),
      { now: () => T0 },
    );
    expect((await rowOf('invite:2'))?.status).toBe('failed');
  });

  it('spends no attempt while the account is refused, and stops the drain', async () => {
    const db = asAnyDb(testDb);
    await enqueueEmail(db, message('invite:2'));
    await testDb.update(emailOutbox).set({ nextAttemptAt: T0 });
    const mailer = scripted({ status: 'blocked', reason: 'brevo 401' });

    const counts = await drainEmailOutbox(db, mailer, { now: () => T0 });
    expect(counts.blocked).toBe(1);
    expect(mailer.seen).toHaveLength(1);
    expect(await rowOf(mailer.seen[0]?.idempotencyKey)).toMatchObject({
      status: 'queued',
      attempts: 0,
      lastError: 'brevo 401',
      nextAttemptAt: after(BLOCKED_DELAY_MS),
    });
  });

  it('sends nothing more once stopped', async () => {
    const stopped = AbortSignal.abort();
    const mailer = scripted();
    await drainEmailOutbox(asAnyDb(testDb), mailer, {
      now: () => T0,
      signal: stopped,
    });
    expect(mailer.seen).toHaveLength(0);
  });

  it('erases old rows with the retention purge, mail job or not', async () => {
    const db = asAnyDb(testDb);
    const now = after(90 * 24 * 3_600_000);
    const limit = cutoff(now, RETENTION.emailOutbox).getTime();
    const early = new Date(limit - 1_000);
    const late = new Date(limit + 1_000);
    for (const key of ['old', 'recent', 'never-sent', 'just-queued']) {
      await enqueueEmail(db, message(key));
    }
    const set = (
      key: string,
      values: Partial<typeof emailOutbox.$inferInsert>,
    ) =>
      testDb
        .update(emailOutbox)
        .set(values)
        .where(eq(emailOutbox.idempotencyKey, key));
    await set('old', { status: 'sent', finishedAt: early });
    await set('recent', { status: 'sent', finishedAt: late });
    await set('never-sent', { createdAt: early });
    await set('just-queued', { createdAt: late });
    await set('invite:1', { createdAt: late });

    await runPurge(db, { now, trigger: 'auto' });

    const keys = (await testDb.select().from(emailOutbox))
      .map((row) => row.idempotencyKey)
      .sort();
    expect(keys).toEqual(['invite:1', 'just-queued', 'recent']);
  });
});
