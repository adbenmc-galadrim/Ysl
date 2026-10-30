import type { AnyDb } from '@repo/db';
import { emailOutbox } from '@repo/db/schema';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { EmailMessage, Mailer, SendResult } from '#features/mail/mailer';

/** Waits after the 1st, 2nd… failed attempt; one attempt more, then `failed`. */
export const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/** Far above one send's timeout: an expired lease means the worker died. */
const LEASE_MS = 2 * 60_000;
const DRAIN_LIMIT = 20;
/** Finished rows hold an address and a message: they do not stay. */
export const FINISHED_RETENTION_MS = 30 * 24 * 60 * 60_000;

export type EnqueueEmail = EmailMessage & { organizationId?: string | null };

type OutboxRow = typeof emailOutbox.$inferSelect;

/** Pass the caller's transaction as `db` so the mail leaves only if it commits. */
export async function enqueueEmail(
  db: AnyDb,
  message: EnqueueEmail,
): Promise<{ created: boolean }> {
  const rows = await db
    .insert(emailOutbox)
    .values({
      idempotencyKey: message.idempotencyKey,
      organizationId: message.organizationId ?? null,
      recipient: message.to,
      recipientName: message.toName ?? null,
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html ?? null,
    })
    .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
    .returning({ id: emailOutbox.id });
  return { created: rows.length > 0 };
}

async function claimOne(db: AnyDb, now: Date): Promise<OutboxRow | undefined> {
  const due = sql`(
    select ${emailOutbox.id} from ${emailOutbox}
    where (
      (${emailOutbox.status} = 'queued' and ${emailOutbox.nextAttemptAt} <= ${now})
      or (${emailOutbox.status} = 'sending' and ${emailOutbox.leaseUntil} <= ${now})
    ) and ${emailOutbox.attempts} < ${MAX_ATTEMPTS}
    order by ${emailOutbox.nextAttemptAt}
    limit 1
    for update skip locked
  )`;
  const [row] = await db
    .update(emailOutbox)
    .set({
      status: 'sending',
      attempts: sql`${emailOutbox.attempts} + 1`,
      leaseUntil: new Date(now.getTime() + LEASE_MS),
    })
    .where(eq(emailOutbox.id, due))
    .returning();
  return row;
}

async function record(
  db: AnyDb,
  row: OutboxRow,
  result: SendResult,
  now: Date,
): Promise<'sent' | 'retry' | 'failed'> {
  const mine = and(
    eq(emailOutbox.id, row.id),
    eq(emailOutbox.status, 'sending'),
    eq(emailOutbox.attempts, row.attempts),
  );
  if (result.status === 'sent') {
    await db
      .update(emailOutbox)
      .set({
        status: 'sent',
        providerMessageId: result.providerMessageId,
        lastError: null,
        leaseUntil: null,
        finishedAt: now,
      })
      .where(mine);
    return 'sent';
  }
  if (result.status === 'rejected' || row.attempts >= MAX_ATTEMPTS) {
    await db
      .update(emailOutbox)
      .set({
        status: 'failed',
        lastError: result.reason,
        leaseUntil: null,
        finishedAt: now,
      })
      .where(mine);
    return 'failed';
  }
  const delay = Math.max(
    RETRY_DELAYS_MS[row.attempts - 1] ?? 0,
    result.retryAfterMs ?? 0,
  );
  await db
    .update(emailOutbox)
    .set({
      status: 'queued',
      lastError: result.reason,
      leaseUntil: null,
      nextAttemptAt: new Date(now.getTime() + delay),
    })
    .where(mine);
  return 'retry';
}

/** Last attempts interrupted by a crash: nothing will claim them any more. */
async function failAbandoned(db: AnyDb, now: Date): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: 'failed',
      lastError: 'interrupted during the last attempt',
      leaseUntil: null,
      finishedAt: now,
    })
    .where(
      and(
        eq(emailOutbox.status, 'sending'),
        lt(emailOutbox.leaseUntil, now),
        sql`${emailOutbox.attempts} >= ${MAX_ATTEMPTS}`,
      ),
    );
}

async function eraseFinished(db: AnyDb, now: Date): Promise<void> {
  await db
    .delete(emailOutbox)
    .where(
      and(
        inArray(emailOutbox.status, ['sent', 'failed']),
        lt(
          emailOutbox.finishedAt,
          new Date(now.getTime() - FINISHED_RETENTION_MS),
        ),
      ),
    );
}

export type DrainCounts = { sent: number; retry: number; failed: number };

/**
 * Sends what is due, one claim at a time: a row is leased only while its own
 * send runs, so several instances can drain together (`SKIP LOCKED`).
 */
export async function drainEmailOutbox(
  db: AnyDb,
  mailer: Mailer,
  { now = () => new Date(), limit = DRAIN_LIMIT } = {},
): Promise<DrainCounts> {
  const counts: DrainCounts = { sent: 0, retry: 0, failed: 0 };
  await failAbandoned(db, now());
  await eraseFinished(db, now());
  for (let index = 0; index < limit; index += 1) {
    const row = await claimOne(db, now());
    if (!row) break;
    const result = await mailer
      .send({
        idempotencyKey: row.idempotencyKey,
        to: row.recipient,
        toName: row.recipientName,
        subject: row.subject,
        text: row.textBody,
        html: row.htmlBody,
      })
      .catch((error: unknown): SendResult => ({
        status: 'retry',
        reason: error instanceof Error ? error.name : 'unknown error',
      }));
    const outcome = await record(db, row, result, now());
    if (outcome === 'sent') counts.sent += 1;
    else if (outcome === 'retry') counts.retry += 1;
    else counts.failed += 1;
  }
  return counts;
}
