import {
  OPERATING_PROFILE_KEY,
  PROFILE_OF_MODEL,
  type ProfileModel,
} from '@repo/contract/operating-profile';
import type { AnyDb } from '@repo/db';
import {
  department,
  organization,
  organizationMember,
  setting,
  user,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';

export const DEFAULT_ORGANIZATION_NAME = 'Service courrier';

/** D22: every company has it from its first day; the department nothing else claims. */
export const MAIL_DEPARTMENT_NAME = 'Service courrier';

/** What a company needs to work: a saved profile, or its shuttle sees a handover the server refuses. */
export async function createCompany(
  db: AnyDb,
  { name, profileModel }: { name: string; profileModel: ProfileModel },
): Promise<string> {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(organization).values({ id, name, profileModel });
    await tx.insert(department).values({
      id: newId(),
      organizationId: id,
      name: MAIL_DEPARTMENT_NAME,
    });
    await tx.insert(setting).values({
      id: newId(),
      organizationId: id,
      key: OPERATING_PROFILE_KEY,
      value: PROFILE_OF_MODEL[profileModel],
    });
  });
  return id;
}

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

export class PlatformAccountError extends Error {
  constructor(email: string) {
    super(`${email} is an app admin: it belongs to no organization.`);
    this.name = 'PlatformAccountError';
  }
}

export type OrganizationChoice =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'new'; name: string };

/**
 * The organization a new or stray account should join: the one named, to be
 * made if it does not exist; otherwise the only one there is, or a first one
 * for an empty database. Two or more without a name is a choice nobody
 * should make silently. Reads only: the choice is made before the account
 * exists, so a refusal leaves nothing behind.
 */
export async function chooseOrganization(
  db: AnyDb,
  name?: string,
): Promise<OrganizationChoice> {
  if (name) {
    const [existing] = await db
      .select()
      .from(organization)
      .where(eq(organization.name, name));
    return existing
      ? { kind: 'existing', id: existing.id, name: existing.name }
      : { kind: 'new', name };
  }
  const all = await db.select().from(organization);
  const [only] = all;
  if (all.length === 1 && only) {
    return { kind: 'existing', id: only.id, name: only.name };
  }
  if (all.length > 1) {
    throw new OrganizationChoiceError(all.map((row) => row.name));
  }
  return { kind: 'new', name: DEFAULT_ORGANIZATION_NAME };
}

/** Same choice for a new account; an app admin gets none, and naming one for it is a mistake. */
export async function chooseOrganizationFor(
  db: AnyDb,
  account: { email: string; role: string },
  name?: string,
): Promise<OrganizationChoice | null> {
  if (account.role !== 'platform_admin') return chooseOrganization(db, name);
  if (name) throw new PlatformAccountError(account.email);
  return null;
}

/** Makes the chosen organization real, once there is an account to put in it. */
export async function ensureOrganization(
  db: AnyDb,
  choice: OrganizationChoice,
): Promise<{ id: string; name: string; created: boolean }> {
  if (choice.kind === 'existing') {
    return { id: choice.id, name: choice.name, created: false };
  }
  // A script's company is a small site until someone says otherwise, as the conversion does.
  const id = await createCompany(db, {
    name: choice.name,
    profileModel: 'small_site',
  });
  return { id, name: choice.name, created: true };
}

/** Both steps at once, for an account that already exists. */
export async function resolveOrganization(
  db: AnyDb,
  name?: string,
): Promise<{ id: string; name: string; created: boolean }> {
  return ensureOrganization(db, await chooseOrganization(db, name));
}

/** The organization a stray account should join; an app admin is refused before one gets created for it. */
export async function resolveOrganizationFor(
  db: AnyDb,
  account: { email: string; role: string | null },
  name?: string,
): Promise<{ id: string; name: string; created: boolean }> {
  if (account.role === 'platform_admin') {
    throw new PlatformAccountError(account.email);
  }
  return resolveOrganization(db, name);
}

/** Makes the account a member; refuses an app admin, and to move one that already belongs elsewhere. */
export async function attachToOrganization(
  db: AnyDb,
  userId: string,
  organizationId: string,
): Promise<void> {
  const [account] = await db
    .select({ email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  if (account?.role === 'platform_admin') {
    throw new PlatformAccountError(account.email);
  }
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

export async function isInSuspendedCompany(
  db: AnyDb,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ suspendedAt: organization.suspendedAt })
    .from(organizationMember)
    .innerJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(eq(organizationMember.userId, userId));
  return Boolean(row?.suspendedAt);
}

/**
 * `gone` once its company was deleted or the account deactivated: its phone
 * empties itself. An account with no company yet counts as active.
 */
export async function accountStanding(
  db: AnyDb,
  userId: string,
): Promise<{
  standing: 'suspended' | 'active' | 'gone';
  reactivatedAt: Date | null;
}> {
  const [row] = await db
    .select({
      banned: user.banned,
      suspendedAt: organization.suspendedAt,
      reactivatedAt: organization.reactivatedAt,
    })
    .from(user)
    .leftJoin(organizationMember, eq(organizationMember.userId, user.id))
    .leftJoin(
      organization,
      eq(organization.id, organizationMember.organizationId),
    )
    .where(eq(user.id, userId));
  if (!row || row.banned) return { standing: 'gone', reactivatedAt: null };
  return {
    standing: row.suspendedAt ? 'suspended' : 'active',
    reactivatedAt: row.reactivatedAt,
  };
}

export async function findUserByEmail(
  db: AnyDb,
  email: string,
): Promise<{ id: string; email: string; role: string | null } | undefined> {
  const [found] = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.email, email));
  return found;
}
