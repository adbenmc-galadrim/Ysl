import type { AnyDb } from '@repo/db';
import { organizationMember } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

/** The mailroom a signed-in account belongs to, or null when nobody attached it yet. */
export async function organizationOf(
  db: AnyDb,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: organizationMember.organizationId })
    .from(organizationMember)
    .where(eq(organizationMember.userId, userId))
    .limit(1);
  return row?.organizationId ?? null;
}
