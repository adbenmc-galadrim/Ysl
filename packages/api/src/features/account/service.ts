import type { Session } from '@repo/auth';
import type { AccountMeOutput } from '@repo/contract/account';
import type { AnyDb } from '@repo/db';
import { organization } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { roleOf } from '#lib/trpc';

export function getAccount(session: Session): AccountMeOutput {
  const { id, name, email } = session.user;
  return { id, name, email, role: roleOf(session) };
}

export async function companyOf(db: AnyDb, organizationId: string) {
  const [company] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return { name: company?.name ?? '' };
}
