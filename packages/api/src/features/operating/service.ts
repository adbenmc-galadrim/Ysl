import { canHandOver } from '@repo/contract/auth';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  operatingImpact,
  parseOperatingProfile,
  type OperatingProfile,
  type OperatingSettings,
  type ParcelCounts,
  departmentConfirmsDeposit,
} from '@repo/contract/operating-profile';
import { noticeRuleOf, type NoticeRule } from '@repo/contract/mail';
import type { AnyDb } from '@repo/db';
import { deposit, organization, parcel, setting } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { confirmDeposit } from '#features/deposits/service';
import type { Access } from '#lib/access';

async function readProfileRow(db: AnyDb, organizationId: string) {
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
  return row;
}

/** The company's profile; without a saved one, what the app did before (D30). */
export async function readOperatingProfile(
  db: AnyDb,
  organizationId: string,
): Promise<OperatingProfile> {
  const row = await readProfileRow(db, organizationId);
  return row ? parseOperatingProfile(row.value) : DEFAULT_OPERATING_PROFILE;
}

/**
 * Whether the company runs tours: only if its profile says so, like the app
 * (`goesOnTour`). Read raw: `parseOperatingProfile` makes a default of what it
 * cannot read, and the default has no shuttle acting as department.
 */
export async function goesOnTour(
  db: AnyDb,
  organizationId: string,
): Promise<boolean> {
  const row = await readProfileRow(db, organizationId);
  const value = row?.value as
    { shuttleActsAsDepartment?: unknown } | null | undefined;
  return value?.shuttleActsAsDepartment === false;
}

/** When this company tells the employee (ME29), read raw like `goesOnTour`. */
export async function noticeRule(
  db: AnyDb,
  organizationId: string,
): Promise<NoticeRule> {
  return noticeRuleOf((await readProfileRow(db, organizationId))?.value);
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
  await db.transaction(async (tx) => {
    await writeOperatingProfile(tx, organizationId, profile, updatedBy);
    // The step just turned off holds for what already waits on it (D31).
    if (departmentConfirmsDeposit(profile)) return;
    const waiting = await tx
      .select({ id: deposit.id })
      .from(deposit)
      .where(
        and(
          eq(deposit.organizationId, organizationId),
          isNull(deposit.confirmedAt),
          isNull(deposit.deletedAt),
        ),
      )
      .for('update');
    for (const { id } of waiting) {
      await confirmDeposit(
        tx,
        { organizationId, userId: updatedBy, name: null },
        null,
        { depositId: id, counted: 0, gap: null },
        { asAnnounced: true },
      );
    }
  });
  return { ...before, profile, applied: impact.parcels };
}
