import {
  COMPANY_RETENTION_KEYS,
  impactRows,
  resolveRetention,
  retentionProblem,
  type CompanyRetentionKey,
  type RetentionAmounts,
  type RetentionImpact,
  type RetentionProblem,
} from '@repo/contract/company-settings';
import { cutoff, type RetentionDuration } from '@repo/contract/retention';
import type { AnyDb } from '@repo/db';
import { sql, type SQL } from 'drizzle-orm';
import {
  readCompanySettings,
  writeCompanySettings,
} from '#features/company/settings';
import { emailsPastTime } from '#features/mail/queue';
import { contactExpired, parcelExpired } from '#features/maintenance/purge';

const inDays = ({ amount, unit }: RetentionDuration) =>
  unit === 'day' ? amount : amount * 30;

async function countOf(db: AnyDb, query: SQL): Promise<number> {
  const result: unknown = await db.execute(query);
  const { rows } = result as { rows: { n: number | string }[] };
  return Number(rows[0]?.n ?? 0);
}

/**
 * What the next purge would take that the current durations keep, or would
 * have taken anyway: only for the durations going down. Each count reads the
 * purge's own rule. A contact freed by a parcel gone the same night is not
 * counted: the purge sees it as used until then.
 */
export async function retentionImpactOf(
  db: AnyDb,
  organizationId: string,
  proposed: RetentionAmounts,
  now: Date,
): Promise<RetentionImpact> {
  const stored = await readCompanySettings(db, organizationId);
  const before = resolveRetention(stored.retention);
  const after = resolveRetention(proposed);
  const lowered = new Set<CompanyRetentionKey>(
    COMPANY_RETENTION_KEYS.filter(
      (key) => inDays(after[key]) < inDays(before[key]),
    ),
  );
  const org = organizationId;
  const live = sql`t.organization_id = ${org} and t.deleted_at is null`;
  const parcels = lowered.has('parcel')
    ? await countOf(
        db,
        sql`select count(*) as n from parcel t where ${live} and (${parcelExpired(cutoff(now, after.parcel))})`,
      )
    : 0;
  const contacts = lowered.has('contact')
    ? await countOf(
        db,
        sql`select count(*) as n from contact t where ${live} and (${contactExpired(cutoff(now, after.contact))})`,
      )
    : 0;
  const emails = lowered.has('emailOutbox')
    ? await countOf(
        db,
        sql`select count(*) as n from email_outbox where organization_id = ${org} and (${emailsPastTime(cutoff(now, after.emailOutbox))})`,
      )
    : 0;
  const proofRules = [
    lowered.has('signature') &&
      sql`(t.has_signature and t.at < ${cutoff(now, after.signature)})`,
    lowered.has('photo') &&
      sql`(t.has_photo and t.at < ${cutoff(now, after.photo)})`,
  ].filter((rule): rule is SQL => rule !== false);
  const proofs = proofRules.length
    ? await countOf(
        db,
        sql`select count(*) as n from handover t where ${live} and (${sql.join(proofRules, sql` or `)})`,
      )
    : 0;
  return {
    parcels,
    contacts,
    emails,
    proofs,
    deviceOnly: (['photo', 'extraction'] as const).filter((key) =>
      lowered.has(key),
    ),
  };
}

export type SaveRetentionOutcome =
  | { status: 'saved'; retention: RetentionAmounts }
  | { status: 'changed'; impact: RetentionImpact }
  | { status: 'refused'; problem: RetentionProblem };

/**
 * Lowering a duration erases data at the next purge (D31 inspires it): the
 * screen announces the rows first, and more rows than announced by now means
 * announcing again, never erasing what nobody was told of.
 */
export async function saveRetention(
  db: AnyDb,
  organizationId: string,
  input: { retention: RetentionAmounts; announced: number },
  updatedBy: string,
  now = new Date(),
): Promise<SaveRetentionOutcome> {
  const problem = retentionProblem(input.retention);
  if (problem) return { status: 'refused', problem };
  const impact = await retentionImpactOf(
    db,
    organizationId,
    input.retention,
    now,
  );
  if (impactRows(impact) > input.announced) {
    return { status: 'changed', impact };
  }
  await writeCompanySettings(
    db,
    organizationId,
    { retention: input.retention },
    updatedBy,
  );
  return { status: 'saved', retention: input.retention };
}
