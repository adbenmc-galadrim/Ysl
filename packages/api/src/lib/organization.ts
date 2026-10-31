import type { AnyDb } from '@repo/db';
import { departmentMember, organizationMember } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

export interface Membership {
  organizationId: string;
  departmentId: string | null;
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
    })
    .from(organizationMember)
    .leftJoin(
      departmentMember,
      eq(departmentMember.userId, organizationMember.userId),
    )
    .where(eq(organizationMember.userId, userId))
    .limit(1);
  return row ?? null;
}
