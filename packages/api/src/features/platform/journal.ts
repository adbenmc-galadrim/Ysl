import type {
  JournalAction,
  JournalDetail,
  JournalInput,
  JournalOutput,
} from '@repo/contract/platform';
import { JOURNAL_PAGE } from '@repo/contract/platform';
import type { AnyDb } from '@repo/db';
import { platformJournal } from '@repo/db/schema';
import { and, count, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { escapeLike } from '#features/accounts/service';

export const JOURNAL_MONTHS = 12;

export type JournalActor = { id: string; name: string };

/**
 * Called in the action's own transaction: no action without its line, nor the
 * reverse. A refusal has no transaction left to join, and passes `db`.
 */
export async function recordPlatformAction(
  db: AnyDb,
  actor: JournalActor,
  company: { id: string; name: string },
  action: JournalAction,
  detail: JournalDetail = {},
): Promise<void> {
  await db.insert(platformJournal).values({
    action,
    companyId: company.id,
    companyName: company.name,
    actorId: actor.id,
    actorName: actor.name,
    detail,
  });
}

const PERIOD_INTERVAL = { '30d': '30 days', '90d': '90 days', '12m': '12 months' };

export async function readJournal(
  db: AnyDb,
  input: JournalInput,
  now = new Date(),
): Promise<JournalOutput> {
  const {
    action,
    period = '12m',
    query,
    companyId,
    offset = 0,
    limit = JOURNAL_PAGE,
  } = input;
  const since = sql`${now.toISOString()}::timestamptz - ${PERIOD_INTERVAL[period]}::interval`;
  const where = and(
    gte(platformJournal.at, since),
    action ? eq(platformJournal.action, action) : undefined,
    companyId ? eq(platformJournal.companyId, companyId) : undefined,
    query ? ilike(platformJournal.companyName, `%${escapeLike(query)}%`) : undefined,
  );
  const [entries, totals] = await Promise.all([
    db
      .select({
        id: platformJournal.id,
        at: platformJournal.at,
        action: platformJournal.action,
        companyId: platformJournal.companyId,
        companyName: platformJournal.companyName,
        actorName: platformJournal.actorName,
        detail: platformJournal.detail,
      })
      .from(platformJournal)
      .where(where)
      .orderBy(desc(platformJournal.at), desc(platformJournal.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(platformJournal).where(where),
  ]);
  return { entries, total: totals[0]?.total ?? 0 };
}

/** Run with the scheduled purge: the company's own retention never reaches this table. */
export async function eraseOldJournal(db: AnyDb, now: Date): Promise<void> {
  await db
    .delete(platformJournal)
    .where(
      lt(
        platformJournal.at,
        sql`${now.toISOString()}::timestamptz - ${`${JOURNAL_MONTHS} months`}::interval`,
      ),
    );
}
