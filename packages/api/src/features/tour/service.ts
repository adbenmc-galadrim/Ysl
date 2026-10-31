import { organizationMember, parcel, user } from '@repo/db/schema';
import type { AnyDb } from '@repo/db';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { parcelCarrier } from '#lib/access';

/** Still to reach its department: what a tour carries or could carry. */
const CARRIED = ['a_completer', 'recu', 'en_route'] as const;

/**
 * On no shuttle's tour: validated by another role, or by an account no longer
 * a shuttle here or suspended. Nobody on a phone reaches these parcels (D31).
 */
function unclaimed(organizationId: string) {
  return and(
    eq(parcel.organizationId, organizationId),
    isNull(parcel.deletedAt),
    inArray(parcel.status, CARRIED),
    sql`not exists (
      select 1 from ${organizationMember}
      join ${user} on ${user.id} = ${organizationMember.userId}
      where ${organizationMember.organizationId} = ${organizationId}
        and ${organizationMember.userId} = ${parcelCarrier}
        and ${user.role} = 'shuttle'
        and coalesce(${user.banned}, false) = false
    )`,
  );
}

export async function countUnclaimed(
  db: AnyDb,
  organizationId: string,
): Promise<number> {
  const [row] = await db
    .select({ parcels: count() })
    .from(parcel)
    .where(unclaimed(organizationId));
  return row?.parcels ?? 0;
}

/** They join this shuttle's tours: the write brings them down at its next pull. Two at once: the first takes them. */
export async function claimUnclaimed(
  db: AnyDb,
  organizationId: string,
  shuttleId: string,
): Promise<number> {
  const claimed = await db
    .update(parcel)
    .set({
      formerShuttleIds: sql`array_append(${parcel.formerShuttleIds}, ${parcelCarrier})`,
      tourShuttleId: shuttleId,
    })
    .where(unclaimed(organizationId))
    .returning({ id: parcel.id });
  return claimed.length;
}
