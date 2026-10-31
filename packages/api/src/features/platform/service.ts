import { stepsChangedFromModel } from '@repo/contract/operating-profile';
import type {
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformOverviewOutput,
} from '@repo/contract/platform';
import type { AnyDb } from '@repo/db';
import { organization, parcel } from '@repo/db/schema';
import { and, asc, count, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { rowsOf } from '#features/maintenance/purge';
import { readOperatingProfile } from '#features/operating/service';
import { type JournalActor, recordPlatformAction } from '#features/platform/journal';

/** Where the client is: a parcel at 23:30 UTC on the last day already counts next month. */
function monthStart(now: Date): SQL {
  const at = sql`${now.toISOString()}::timestamptz at time zone 'Europe/Paris'`;
  return sql`(date_trunc('month', ${at}) at time zone 'Europe/Paris')`;
}

/** Aggregates only: not one row of a company leaves this query (D26). */
export async function getPlatformOverview(
  db: AnyDb,
  now = new Date(),
): Promise<PlatformOverviewOutput> {
  const from = monthStart(now);
  const asOf = sql`${now.toISOString()}::timestamptz`;
  const [row] = await rowsOf<PlatformOverviewOutput>(
    db,
    sql`select
          (select count(*)::int from organization) as "companies",
          (select count(*)::int from organization where suspended_at is not null) as "suspendedCompanies",
          (select count(*)::int from organization_member) as "accounts",
          (select count(*)::int from department where deleted_at is null) as "departments",
          (select count(*)::int from parcel
            where deleted_at is null and received_at >= ${from} and received_at <= ${asOf}) as "parcelsThisMonth"`,
  );
  return row!;
}

/** A phone's clock may run ahead: nothing counts or dates after the server's now. */
const companyColumns = (now: Date) => {
  const from = monthStart(now);
  const asOf = sql`${now.toISOString()}::timestamptz`;
  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt,
    suspendedAt: organization.suspendedAt,
    profileModel: organization.profileModel,
    departments: sql<number>`(select count(*)::int from department d where d.organization_id = "organization"."id" and d.deleted_at is null)`,
    accounts: sql<number>`(select count(*)::int from organization_member m where m.organization_id = "organization"."id")`,
    parcelsThisMonth: sql<number>`(select count(*)::int from parcel p where p.organization_id = "organization"."id" and p.deleted_at is null and p.received_at >= ${from} and p.received_at <= ${asOf})`,
    lastActivityAt: sql<Date | null>`greatest(
      (select max(e.at) from event e where e.organization_id = "organization"."id" and e.at <= ${asOf}),
      (select max(p.received_at) from parcel p where p.organization_id = "organization"."id" and p.deleted_at is null and p.received_at <= ${asOf})
    )`.mapWith((value: string | Date) => new Date(value)),
  };
};

export async function listCompanies(
  db: AnyDb,
  now = new Date(),
): Promise<PlatformCompany[]> {
  return db
    .select(companyColumns(now))
    .from(organization)
    .orderBy(asc(sql`lower(${organization.name})`));
}

export async function getCompany(
  db: AnyDb,
  id: string,
): Promise<PlatformCompanyDetail | null> {
  const [row] = await db
    .select(companyColumns(new Date()))
    .from(organization)
    .where(eq(organization.id, id));
  if (!row) return null;
  const [parcels] = await db
    .select({ n: count() })
    .from(parcel)
    .where(and(eq(parcel.organizationId, id), isNull(parcel.deletedAt)));
  return {
    ...row,
    parcels: parcels?.n ?? 0,
    changedSteps: row.profileModel
      ? stepsChangedFromModel(
          row.profileModel,
          await readOperatingProfile(db, id),
        )
      : null,
  };
}

/** Two clients of one name could not be told apart, nor confirmed by typing it. */
export async function companyNameTaken(
  db: AnyDb,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(
      and(
        sql`lower(${organization.name}) = lower(${name})`,
        exceptId ? ne(organization.id, exceptId) : undefined,
      ),
    );
  return Boolean(row);
}

/** The same name again changes nothing, and writes nothing. */
export async function renameCompany(
  db: AnyDb,
  id: string,
  name: string,
  actor: JournalActor,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [company] = await tx
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, id))
      .for('update');
    if (!company) return false;
    if (company.name === name) return true;
    await tx.update(organization).set({ name }).where(eq(organization.id, id));
    await recordPlatformAction(tx, actor, { id, name }, 'company_renamed', {
      previousName: company.name,
    });
    return true;
  });
}

/**
 * Keeps the first date: a second tap does not restart the suspension, nor a stray
 * one mark a return; neither happened, so neither reaches the journal.
 */
export async function setCompanySuspended(
  db: AnyDb,
  id: string,
  suspended: boolean,
  actor: JournalActor,
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [company] = await tx
      .select({ name: organization.name, suspendedAt: organization.suspendedAt })
      .from(organization)
      .where(eq(organization.id, id))
      .for('update');
    if (!company) return false;
    if (suspended === (company.suspendedAt !== null)) return true;
    await tx
      .update(organization)
      .set(
        suspended
          ? { suspendedAt: now }
          : { suspendedAt: null, reactivatedAt: now },
      )
      .where(eq(organization.id, id));
    await recordPlatformAction(
      tx,
      actor,
      { id, name: company.name },
      suspended ? 'company_suspended' : 'company_reactivated',
    );
    return true;
  });
}
