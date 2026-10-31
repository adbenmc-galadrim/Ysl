import { stepsChangedFromModel } from '@repo/contract/operating-profile';
import type {
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformOverviewOutput,
} from '@repo/contract/platform';
import type { AnyDb } from '@repo/db';
import { organization, parcel } from '@repo/db/schema';
import { and, asc, count, eq, isNull, ne, sql } from 'drizzle-orm';
import { readOperatingProfile } from '#features/operating/service';

export async function getPlatformOverview(
  db: AnyDb,
): Promise<PlatformOverviewOutput> {
  const [row] = await db.select({ companies: count() }).from(organization);
  return { companies: row?.companies ?? 0 };
}

const companyColumns = {
  id: organization.id,
  name: organization.name,
  createdAt: organization.createdAt,
  suspendedAt: organization.suspendedAt,
  profileModel: organization.profileModel,
  departments: sql<number>`(select count(*)::int from department d where d.organization_id = "organization"."id" and d.deleted_at is null)`,
  accounts: sql<number>`(select count(*)::int from organization_member m where m.organization_id = "organization"."id")`,
};

export async function listCompanies(db: AnyDb): Promise<PlatformCompany[]> {
  return db
    .select(companyColumns)
    .from(organization)
    .orderBy(asc(sql`lower(${organization.name})`));
}

export async function getCompany(
  db: AnyDb,
  id: string,
): Promise<PlatformCompanyDetail | null> {
  const [row] = await db
    .select(companyColumns)
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

export async function renameCompany(
  db: AnyDb,
  id: string,
  name: string,
): Promise<boolean> {
  const rows = await db
    .update(organization)
    .set({ name })
    .where(eq(organization.id, id))
    .returning({ id: organization.id });
  return rows.length > 0;
}

/** Keeps the first date: a second tap does not restart the suspension, nor a stray one mark a return. */
export async function setCompanySuspended(
  db: AnyDb,
  id: string,
  suspended: boolean,
  now = new Date(),
): Promise<boolean> {
  const at = sql`${now.toISOString()}::timestamptz`;
  const rows = await db
    .update(organization)
    .set(
      suspended
        ? { suspendedAt: sql`coalesce("suspended_at", ${at})` }
        : {
            suspendedAt: null,
            reactivatedAt: sql`case when "suspended_at" is null then "reactivated_at" else ${at} end`,
          },
    )
    .where(eq(organization.id, id))
    .returning({ id: organization.id });
  return rows.length > 0;
}
