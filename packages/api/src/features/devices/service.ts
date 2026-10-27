import type { Device } from '@repo/contract/devices';
import type { AnyDb } from '@repo/db';
import { organizationMember, session, user } from '@repo/db/schema';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';

/** The live sessions of the mailroom's members, the most recently signed in first. */
export async function listDevices(
  db: AnyDb,
  {
    organizationId,
    currentSessionId,
    now = new Date(),
  }: { organizationId: string; currentSessionId: string; now?: Date },
): Promise<Device[]> {
  const rows = await db
    .select({
      id: session.id,
      userName: user.name,
      userAgent: session.userAgent,
      signedInAt: session.createdAt,
    })
    .from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .innerJoin(organizationMember, eq(organizationMember.userId, user.id))
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        gt(session.expiresAt, now),
      ),
    )
    .orderBy(desc(session.createdAt));
  return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
}

export type RevokeOutcome = 'revoked' | 'current' | 'notFound';

/**
 * Deletes the session: Better Auth reads it from the table at every request,
 * so the device is signed out at its next one. Only within the mailroom; the
 * admin's own device goes through "Effacer les données de cet iPhone".
 */
export async function revokeDevice(
  db: AnyDb,
  {
    organizationId,
    currentSessionId,
    id,
  }: { organizationId: string; currentSessionId: string; id: string },
): Promise<RevokeOutcome> {
  if (id === currentSessionId) return 'current';
  const members = db
    .select({ userId: organizationMember.userId })
    .from(organizationMember)
    .where(eq(organizationMember.organizationId, organizationId));
  const deleted = await db
    .delete(session)
    .where(and(eq(session.id, id), inArray(session.userId, members)))
    .returning({ id: session.id });
  return deleted.length > 0 ? 'revoked' : 'notFound';
}
