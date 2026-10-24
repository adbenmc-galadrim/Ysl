import type { AnyDb } from '@repo/db';
import { organization, organizationMember, user } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';

export const DEFAULT_ORGANIZATION_NAME = 'Service courrier';

export class OrganizationChoiceError extends Error {
  constructor(names: string[]) {
    super(
      `Several organizations exist (${names.join(', ')}): name one with --organization.`,
    );
    this.name = 'OrganizationChoiceError';
  }
}

export class AlreadyAttachedError extends Error {
  constructor(email: string, name: string) {
    super(`${email} already belongs to ${name}.`);
    this.name = 'AlreadyAttachedError';
  }
}

/**
 * The organization a new or stray account should join: the one named, made
 * on the spot if needed; otherwise the only one there is, or a first one for
 * an empty database. Two or more without a name is a choice nobody should
 * make silently.
 */
export async function resolveOrganization(
  db: AnyDb,
  name?: string,
): Promise<{ id: string; name: string; created: boolean }> {
  if (name) {
    const [existing] = await db
      .select()
      .from(organization)
      .where(eq(organization.name, name));
    if (existing)
      return { id: existing.id, name: existing.name, created: false };
    return create(db, name);
  }
  const all = await db.select().from(organization);
  const [only] = all;
  if (all.length === 1 && only) {
    return { id: only.id, name: only.name, created: false };
  }
  if (all.length > 1) {
    throw new OrganizationChoiceError(all.map((row) => row.name));
  }
  return create(db, DEFAULT_ORGANIZATION_NAME);
}

async function create(db: AnyDb, name: string) {
  const id = newId();
  await db.insert(organization).values({ id, name });
  return { id, name, created: true };
}

/** Makes the account a member; refuses to move one that already belongs elsewhere. */
export async function attachToOrganization(
  db: AnyDb,
  userId: string,
  organizationId: string,
): Promise<void> {
  const [current] = await db
    .select({
      organizationId: organizationMember.organizationId,
      name: organization.name,
      email: user.email,
    })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(eq(organizationMember.userId, userId));
  if (current) {
    if (current.organizationId === organizationId) return;
    throw new AlreadyAttachedError(current.email, current.name);
  }
  await db.insert(organizationMember).values({ userId, organizationId });
}

export async function findUserByEmail(
  db: AnyDb,
  email: string,
): Promise<{ id: string; email: string } | undefined> {
  const [found] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email));
  return found;
}
