import type { AnyDb } from '@repo/db';
import {
  departmentMember,
  organization,
  organizationMember,
} from '@repo/db/schema';
import { eq } from 'drizzle-orm';

export interface Membership {
  organizationId: string;
  departmentId: string | null;
  suspended: boolean;
}

/** The company a signed-in account belongs to and its department, or null when nobody attached it yet. */
export async function membershipOf(
  db: AnyDb,
  userId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select({
      organizationId: organizationMember.organizationId,
      departmentId: departmentMember.departmentId,
      suspendedAt: organization.suspendedAt,
    })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .leftJoin(
      departmentMember,
      eq(departmentMember.userId, organizationMember.userId),
    )
    .where(eq(organizationMember.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    organizationId: row.organizationId,
    departmentId: row.departmentId,
    suspended: row.suspendedAt !== null,
  };
}

