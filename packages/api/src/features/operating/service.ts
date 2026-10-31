import { canHandOver } from '@repo/contract/auth';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  operatingImpact,
  parseOperatingProfile,
  type OperatingProfile,
  type OperatingSettings,
  type ParcelCounts,
} from '@repo/contract/operating-profile';
import type { AnyDb } from '@repo/db';
import { organization, parcel, setting } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import type { Access } from '#lib/access';

/** The company's profile; without a saved one, what the app did before (D30). */
export async function readOperatingProfile(
  db: AnyDb,
  organizationId: string,
): Promise<OperatingProfile> {
  const [row] = await db
    .select({ value: setting.value })
    .from(setting)
    .where(
      and(
        eq(setting.organizationId, organizationId),
        eq(setting.key, OPERATING_PROFILE_KEY),
        isNull(setting.deletedAt),
      ),
    );
  return row ? parseOperatingProfile(row.value) : DEFAULT_OPERATING_PROFILE;
}

/** Only the shuttle's answer depends on the profile: nobody else pays for the read. */
export async function mayHandOver(
  db: AnyDb,
  { organizationId, role }: Access,
): Promise<boolean> {
  return canHandOver(
    role,
    role === 'shuttle'
      ? await readOperatingProfile(db, organizationId)
      : DEFAULT_OPERATING_PROFILE,
  );
}

async function countParcels(
  db: AnyDb,
  organizationId: string,
): Promise<ParcelCounts> {
  const rows = await db
    .select({ status: parcel.status, parcels: count() })
    .from(parcel)
    .where(
      and(eq(parcel.organizationId, organizationId), isNull(parcel.deletedAt)),
    )
    .groupBy(parcel.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.parcels]));
}

export async function getOperatingSettings(
  db: AnyDb,
  organizationId: string,
): Promise<OperatingSettings> {
  const [profile, counts, [company]] = await Promise.all([
    readOperatingProfile(db, organizationId),
    countParcels(db, organizationId),
    db
      .select({ profileModel: organization.profileModel })
      .from(organization)
      .where(eq(organization.id, organizationId)),
  ]);
  return { profile, counts, profileModel: company?.profileModel ?? null };
}

/** Writes the one row of the company; the synchronisation takes it to the devices. */
export async function writeOperatingProfile(
  db: AnyDb,
  organizationId: string,
  profile: OperatingProfile,
  updatedBy: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .insert(setting)
    .values({
      id: newId(),
      organizationId,
      key: OPERATING_PROFILE_KEY,
      value: profile,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [setting.organizationId, setting.key],
      targetWhere: sql`${setting.deletedAt} is null`,
      set: { value: profile, updatedBy, updatedAt: now },
    });
}

/** Holds at once for every parcel (D31): nothing on a parcel remembers the old profile. */
export async function saveOperatingProfile(
  db: AnyDb,
  organizationId: string,
  profile: OperatingProfile,
  updatedBy: string,
): Promise<OperatingSettings & { applied: number }> {
  const before = await getOperatingSettings(db, organizationId);
  const impact = operatingImpact(before.profile, profile, before.counts);
  if (impact.changes.length === 0) return { ...before, applied: 0 };
  await writeOperatingProfile(db, organizationId, profile, updatedBy);
  return { ...before, profile, applied: impact.parcels };
}
