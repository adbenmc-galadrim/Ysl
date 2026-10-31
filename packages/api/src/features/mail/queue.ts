import { cutoff, RETENTION } from '@repo/contract/retention';
import type { AnyDb } from '@repo/db';
import { emailOutbox, notification } from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { logger } from '@repo/shared/logger';
import { and, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { EmailMessage, Mailer, SendResult } from '#features/mail/mailer';
import { senderOf } from '#features/mail/sender';
import {
  parcelsToTell,
  REQUEST_MAX_AGE_MS,
  settleFailed,
  settleSent,
} from '#features/mail/settle';

const t = createTranslator(DEFAULT_LOCALE);

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
/** Until the next look at an account the provider refuses. */
export const BLOCKED_DELAY_MS = 5 * 60_000;

export type EnqueueEmail = EmailMessage & {
  organizationId?: string | null;
  notificationId?: string | null;
  pickupCodeId?: string | null;
  replacedCodeId?: string | null;
};

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
      notificationId: message.notificationId ?? null,
      recipient: message.to,
      recipientName: message.toName ?? null,
      subject: message.subject,
      textBody: message.text,
      htmlBody: message.html ?? null,
      replyTo: message.replyTo ?? null,
      attachments: message.attachments ?? null,
      pickupCodeId: message.pickupCodeId ?? null,
      replacedCodeId: message.replacedCodeId ?? null,
    })
    .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
    .returning({ id: emailOutbox.id });
  return { created: rows.length > 0 };
}

const SUPERSEDED = 'superseded';
const EXPIRED = 'expired';

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

async function failNotification(
  tx: AnyDb,
  row: Pick<OutboxRow, 'notificationId' | 'pickupCodeId' | 'replacedCodeId'>,
  reason: string,
  now: Date,
): Promise<void> {
  if (!row.notificationId) return;
  await settleFailed(
    tx,
    row.notificationId,
    t(
      reason === SUPERSEDED
        ? 'mail.server.superseded'
        : reason === EXPIRED
          ? 'mail.server.expired'
          : 'mail.server.failed',
    ),
    row,
    now,
  );
}

/** Once a row is over, the code it quotes stays in nobody's table in clear. */
const ERASED = {
  textBody: '',
  htmlBody: null,
  replyTo: null,
  attachments: null,
};

/** Each outcome moves the mail's notification with the row: both or neither. */
async function record(
  db: AnyDb,
  row: OutboxRow,
  result: SendResult,
  now: Date,
): Promise<'sent' | 'retry' | 'blocked' | 'failed'> {
  const mine = and(
    eq(emailOutbox.id, row.id),
    eq(emailOutbox.status, 'sending'),
    eq(emailOutbox.attempts, row.attempts),
  );
  if (result.status === 'sent') {
    await db.transaction(async (tx) => {
      const moved = await tx
        .update(emailOutbox)
        .set({
          ...ERASED,
          status: 'sent',
          providerMessageId: result.providerMessageId,
          lastError: null,
          leaseUntil: null,
          finishedAt: now,
        })
        .where(mine)
        .returning({ id: emailOutbox.id });
      if (moved.length > 0 && row.notificationId) {
        await settleSent(tx, row.notificationId, now);
      }
    });
    return 'sent';
  }
  if (result.status === 'blocked') {
    await db
      .update(emailOutbox)
      .set({
        status: 'queued',
        attempts: row.attempts - 1,
        lastError: result.reason,
        leaseUntil: null,
        nextAttemptAt: new Date(now.getTime() + BLOCKED_DELAY_MS),
      })
      .where(mine);
    return 'blocked';
  }
  if (result.status === 'rejected' || row.attempts >= MAX_ATTEMPTS) {
    await db.transaction(async (tx) => {
      const moved = await tx
        .update(emailOutbox)
        .set({
          ...ERASED,
          status: 'failed',
          lastError: result.reason,
          leaseUntil: null,
          finishedAt: now,
        })
        .where(mine)
        .returning({ id: emailOutbox.id });
      if (moved.length > 0) await failNotification(tx, row, result.reason, now);
    });
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
  const reason = 'interrupted during the last attempt';
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(emailOutbox)
      .set({
        ...ERASED,
        status: 'failed',
        lastError: reason,
        leaseUntil: null,
        finishedAt: now,
      })
      .where(
        and(
          eq(emailOutbox.status, 'sending'),
          lt(emailOutbox.leaseUntil, now),
          sql`${emailOutbox.attempts} >= ${MAX_ATTEMPTS}`,
        ),
      )
      .returning();
    for (const row of rows) await failNotification(tx, row, reason, now);
  });
}

/** The phone told these parcels while the mail waited: it does not leave as well. */
async function superseded(
  db: AnyDb,
  row: OutboxRow,
  now: Date,
): Promise<typeof SUPERSEDED | typeof EXPIRED | null> {
  if (!row.notificationId) return null;
  const [request] = await db
    .select()
    .from(notification)
    .where(eq(notification.id, row.notificationId));
  if (!request || request.channel !== 'server') return null;
  if (request.status !== 'prepared') return SUPERSEDED;
  // Held back by a refused account: its text is out of date, and the former code goes back.
  if (now.getTime() - request.preparedAt.getTime() > REQUEST_MAX_AGE_MS) {
    return EXPIRED;
  }
  const { parcels } = await parcelsToTell(db, request);
  return parcels.length === 0 ? SUPERSEDED : null;
}

/**
 * A company's domain refused after its check (DNS gone, sender withdrawn): the
 * mail leaves from the platform's address rather than not at all, and one
 * company's refusal does not stop the queue. A refused account fails again here.
 */
export async function sendFrom(
  mailer: Mailer,
  message: EmailMessage,
  from: EmailMessage['from'],
): Promise<SendResult> {
  const result = await mailer.send({ ...message, from });
  if (
    !from?.email ||
    (result.status !== 'rejected' && result.status !== 'blocked')
  ) {
    return result;
  }
  logger.warn({ reason: result.reason }, 'company sender refused');
  return mailer.send({ ...message, from: { name: from.name } });
}

/**
 * Rows hold an address and a text: finished ones do not stay, nor do those
 * that never left (no key, account refused), nor one a stopped job left
 * `sending`, its lease long over.
 */
export function emailsPastTime(before: Date): SQL {
  return or(
    and(
      inArray(emailOutbox.status, ['sent', 'failed']),
      lt(emailOutbox.finishedAt, before),
    ),
    and(eq(emailOutbox.status, 'queued'), lt(emailOutbox.createdAt, before)),
    and(eq(emailOutbox.status, 'sending'), lt(emailOutbox.leaseUntil, before)),
  )!;
}

/** Part of the retention purge, so it runs even when the mail job is off. */
export async function eraseCompanyEmails(
  db: AnyDb,
  organizationId: string,
  before: Date,
): Promise<void> {
  await db
    .delete(emailOutbox)
    .where(
      and(
        eq(emailOutbox.organizationId, organizationId),
        emailsPastTime(before),
      ),
    );
}

/** A mail of no company (a test, a script) goes by the default. */
export async function eraseUnownedEmails(db: AnyDb, now: Date): Promise<void> {
  await db
    .delete(emailOutbox)
    .where(
      and(
        isNull(emailOutbox.organizationId),
        emailsPastTime(cutoff(now, RETENTION.emailOutbox)),
      ),
    );
}

export type DrainCounts = {
  sent: number;
  retry: number;
  blocked: number;
  failed: number;
};

/**
 * Sends what is due, one claim at a time: a row is leased only while its own
 * send runs, so several instances can drain together (`SKIP LOCKED`).
 */
export async function drainEmailOutbox(
  db: AnyDb,
  mailer: Mailer,
  {
    now = () => new Date(),
    limit = DRAIN_LIMIT,
    signal,
  }: { now?: () => Date; limit?: number; signal?: AbortSignal } = {},
): Promise<DrainCounts> {
  const counts: DrainCounts = { sent: 0, retry: 0, blocked: 0, failed: 0 };
  await failAbandoned(db, now());
  for (let index = 0; index < limit && !signal?.aborted; index += 1) {
    const row = await claimOne(db, now());
    if (!row) break;
    const result = await superseded(db, row, now())
      .then(async (over): Promise<SendResult> => {
        if (over) return { status: 'rejected', reason: over };
        return sendFrom(
          mailer,
          {
            idempotencyKey: row.idempotencyKey,
            to: row.recipient,
            toName: row.recipientName,
            subject: row.subject,
            text: row.textBody,
            html: row.htmlBody,
            replyTo: row.replyTo,
            attachments: row.attachments,
          },
          await senderOf(db, row.organizationId),
        );
      })
      .catch((error: unknown): SendResult => ({
        status: 'retry',
        reason: error instanceof Error ? error.name : 'unknown error',
      }));
    const outcome = await record(db, row, result, now());
    if (outcome === 'blocked') {
      counts.blocked += 1;
      break;
    }
    if (outcome === 'sent') counts.sent += 1;
    else if (outcome === 'retry') counts.retry += 1;
    else counts.failed += 1;
  }
  return counts;
}
