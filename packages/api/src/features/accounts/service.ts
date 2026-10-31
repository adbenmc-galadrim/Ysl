import { CREDENTIAL_PROVIDER, setPassword } from '@repo/auth/password';
import {
  ACCOUNTS_PAGE_SIZE,
  type AccountRecord,
  accountStateOf,
  BAN_REASON,
  type CreateAccountInput,
  type LinkDelivery,
  type ListAccountsInput,
  type ListAccountsOutput,
  type ReinstateAccountInput,
  type ResetAccountPasswordInput,
  type SendAccountLinkInput,
  type SetAccountRoleInput,
} from '@repo/contract/accounts';
import { toUserRole } from '@repo/contract/auth';
import type { AnyDb } from '@repo/db';
import {
  account,
  accountInvitation,
  department,
  departmentMember,
  organization,
  organizationMember,
  session,
  user,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  not,
  or,
  sql,
} from 'drizzle-orm';
import { deliverLink } from '#features/invitations/delivery';
import { issueLink } from '#features/invitations/link';
import { HAS_PASSWORD } from '#features/invitations/service';
import { sqlState } from '#features/sync/errors';

const translate = createTranslator(DEFAULT_LOCALE);

const UNIQUE_VIOLATION = '23505';
const PLATFORM_ROLE = 'platform_admin';
const ADMIN_ROLE = 'company_admin';

type Tx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

function notFound(): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: translate('accounts.error.notFound'),
  });
}

function departmentNotFound(): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: translate('accounts.error.departmentNotFound'),
  });
}

/** Members of this company; an app admin promoted into one by mistake stays out of reach. */
function inCompany(organizationId: string) {
  return and(
    eq(organizationMember.organizationId, organizationId),
    or(isNull(user.role), ne(user.role, PLATFORM_ROLE)),
  );
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

const SELECTION = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  banReason: user.banReason,
  departmentId: departmentMember.departmentId,
  departmentName: department.name,
};

function baseQuery(db: AnyDb) {
  return db
    .select(SELECTION)
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .leftJoin(departmentMember, eq(departmentMember.userId, user.id))
    .leftJoin(department, eq(department.id, departmentMember.departmentId))
    .$dynamic();
}

type Row = Awaited<ReturnType<typeof baseQuery>>[number];

async function withDevices(
  db: AnyDb,
  rows: Row[],
  now = new Date(),
): Promise<AccountRecord[]> {
  const ids = rows.map((row) => row.id);
  const sessions = ids.length
    ? await db
        .select({
          userId: session.userId,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })
        .from(session)
        .where(inArray(session.userId, ids))
    : [];
  const credentials = ids.length
    ? await db
        .select({ userId: account.userId })
        .from(account)
        .where(
          and(
            inArray(account.userId, ids),
            eq(account.providerId, CREDENTIAL_PROVIDER),
          ),
        )
    : [];
  const withPassword = new Set(credentials.map((row) => row.userId));
  const links = ids.length
    ? await db
        .select({
          userId: accountInvitation.userId,
          expiresAt: accountInvitation.expiresAt,
        })
        .from(accountInvitation)
        .where(
          and(
            inArray(accountInvitation.userId, ids),
            isNull(accountInvitation.usedAt),
          ),
        )
    : [];
  return rows.map((row) => {
    const own = sessions.filter((entry) => entry.userId === row.id);
    const last = own.reduce<Date | null>(
      (latest, entry) =>
        !latest || entry.createdAt > latest ? entry.createdAt : latest,
      null,
    );
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: toUserRole(row.role),
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      state:
        accountStateOf(row) === 'active' && !withPassword.has(row.id)
          ? 'invited'
          : accountStateOf(row),
      lastSignInAt: last,
      deviceAgents: own
        .filter((entry) => entry.expiresAt > now)
        .map((entry) => entry.userAgent),
      linkExpiresAt:
        links.find((link) => link.userId === row.id)?.expiresAt ?? null,
    };
  });
}

function stateFilter(state: ListAccountsInput['state']) {
  switch (state) {
    case 'active':
      return and(or(isNull(user.banned), eq(user.banned, false)), HAS_PASSWORD);
    case 'invited':
      return and(
        or(isNull(user.banned), eq(user.banned, false)),
        not(HAS_PASSWORD),
      );
    case 'revoked':
      return and(eq(user.banned, true), eq(user.banReason, BAN_REASON.revoked));
    case 'suspended':
      return and(
        eq(user.banned, true),
        or(isNull(user.banReason), ne(user.banReason, BAN_REASON.revoked)),
      );
    default:
      return undefined;
  }
}

export async function listAccounts(
  db: AnyDb,
  organizationId: string,
  input: ListAccountsInput,
): Promise<ListAccountsOutput> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? ACCOUNTS_PAGE_SIZE;
  const pattern = input.search ? `%${escapeLike(input.search)}%` : null;
  const filters = and(
    inCompany(organizationId),
    input.role ? eq(user.role, input.role) : undefined,
    input.departmentId
      ? eq(departmentMember.departmentId, input.departmentId)
      : undefined,
    stateFilter(input.state),
    pattern
      ? or(ilike(user.name, pattern), ilike(user.email, pattern))
      : undefined,
  );
  const rows = await baseQuery(db)
    .where(filters)
    .orderBy(asc(user.name), asc(user.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [matching] = await db
    .select({ total: count() })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .leftJoin(departmentMember, eq(departmentMember.userId, user.id))
    .where(filters);
  const byRole = await db
    .select({ role: user.role, total: count() })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(inCompany(organizationId))
    .groupBy(user.role);
  const [invited] = await db
    .select({ total: count() })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(and(inCompany(organizationId), stateFilter('invited')));
  const countOf = (role: string) =>
    byRole.find((entry) => entry.role === role)?.total ?? 0;
  return {
    rows: await withDevices(db, rows),
    total: matching?.total ?? 0,
    counts: {
      all: byRole.reduce((sum, entry) => sum + entry.total, 0),
      shuttle: countOf('shuttle'),
      department: countOf('department'),
      company_admin: countOf(ADMIN_ROLE),
      invited: invited?.total ?? 0,
    },
  };
}

export async function getAccountRecord(
  db: AnyDb,
  organizationId: string,
  userId: string,
): Promise<AccountRecord> {
  const rows = await baseQuery(db).where(
    and(inCompany(organizationId), eq(user.id, userId)),
  );
  const [record] = await withDevices(db, rows);
  if (!record) throw notFound();
  return record;
}

async function requireDepartment(
  db: AnyDb | Tx,
  organizationId: string,
  id: string,
): Promise<void> {
  const [found] = await db
    .select({ id: department.id })
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        eq(department.id, id),
        isNull(department.deletedAt),
      ),
    );
  if (!found) throw departmentNotFound();
}

/**
 * Written here rather than by Better Auth's admin API, which ignores companies:
 * all or nothing. No credential: nobody can sign in until the link is used.
 */
export async function createAccount(
  db: AnyDb,
  organizationId: string,
  input: CreateAccountInput,
  invitedBy: string,
): Promise<{ account: AccountRecord; link: LinkDelivery }> {
  const userId = newId();
  const email = input.email.toLowerCase();
  let issued: Awaited<ReturnType<typeof issueLink>>;
  try {
    issued = await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: input.name,
        email,
        role: input.role,
      });
      await tx.insert(organizationMember).values({ userId, organizationId });
      if (input.departmentId) {
        await requireDepartment(tx, organizationId, input.departmentId);
        await tx.insert(departmentMember).values({
          userId,
          organizationId,
          departmentId: input.departmentId,
        });
      }
      return issueLink(tx, { userId, organizationId });
    });
  } catch (error) {
    if (sqlState(error) !== UNIQUE_VIOLATION) throw error;
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('accounts.error.emailTaken'),
    });
  }
  const link = await deliverLink(
    db,
    {
      organizationId,
      name: input.name,
      email,
      role: input.role,
      kind: 'invite',
      invitedBy,
    },
    issued,
  );
  return { account: await getAccountRecord(db, organizationId, userId), link };
}

/** « Renvoyer un lien »: the old one stops working, open sessions stay. */
export async function sendAccountLink(
  db: AnyDb,
  organizationId: string,
  input: SendAccountLinkInput,
  invitedBy: string,
): Promise<LinkDelivery> {
  const target = await getAccountRecord(db, organizationId, input.userId);
  if (target.state === 'revoked' || target.state === 'suspended') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: translate(`accounts.error.link.${target.state}`),
    });
  }
  const issued = await issueLink(db, { userId: target.id, organizationId });
  return deliverLink(
    db,
    {
      organizationId,
      name: target.name,
      email: target.email,
      role: target.role,
      kind: target.state === 'invited' ? 'invite' : 'reset',
      invitedBy,
    },
    issued,
    { copy: input.copy },
  );
}

/** The target, or a 404 for anyone outside this company. */
async function targetOf(
  db: AnyDb | Tx,
  organizationId: string,
  userId: string,
) {
  const [target] = await db
    .select({
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
    })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(and(inCompany(organizationId), eq(user.id, userId)));
  if (!target) throw notFound();
  return target;
}

export async function setAccountRole(
  db: AnyDb,
  organizationId: string,
  input: SetAccountRoleInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const target = await targetOf(tx, organizationId, input.userId);
    if (target.role === ADMIN_ROLE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: translate('accounts.error.adminRole'),
      });
    }
    if (accountStateOf(target) === 'revoked') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: translate('accounts.error.revoked'),
      });
    }
    if (input.departmentId) {
      await requireDepartment(tx, organizationId, input.departmentId);
      await tx
        .insert(departmentMember)
        .values({
          userId: input.userId,
          organizationId,
          departmentId: input.departmentId,
        })
        .onConflictDoUpdate({
          target: departmentMember.userId,
          set: { departmentId: input.departmentId },
        });
    } else {
      await tx
        .delete(departmentMember)
        .where(eq(departmentMember.userId, input.userId));
    }
    await tx
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.id, input.userId));
  });
}

/**
 * Refuses to take the company's last active admin. The company row is locked
 * first, so two admins suspending each other at once cannot both pass.
 */
async function refuseLastAdmin(
  tx: Tx,
  organizationId: string,
  userId: string,
): Promise<void> {
  await tx
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .for('update');
  const target = await targetOf(tx, organizationId, userId);
  if (target.role !== ADMIN_ROLE || accountStateOf(target) !== 'active') {
    return;
  }
  const [others] = await tx
    .select({ total: count() })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(user.role, ADMIN_ROLE),
        ne(user.id, userId),
        sql`${user.banned} is not true`,
        // An invitation nobody answered runs nothing: the company would be left without an admin.
        HAS_PASSWORD,
      ),
    );
  if (!others?.total) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('accounts.error.lastAdmin'),
    });
  }
}

/**
 * Keeps the sessions on purpose: a phone told it has none empties itself
 * (`settleSession`), and a suspension must not cost it photos and proofs.
 * `protectedProcedure` refuses every request, Better Auth every new sign-in.
 */
export async function suspendAccount(
  db: AnyDb,
  organizationId: string,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await refuseLastAdmin(tx, organizationId, userId);
    const target = await targetOf(tx, organizationId, userId);
    if (accountStateOf(target) === 'revoked') return;
    await tx
      .update(user)
      .set({
        banned: true,
        banReason: BAN_REASON.suspended,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  });
}

/** Closes the sessions, so its phones erase themselves at their next request. */
export async function revokeAccount(
  db: AnyDb,
  organizationId: string,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await refuseLastAdmin(tx, organizationId, userId);
    await tx
      .update(user)
      .set({
        banned: true,
        banReason: BAN_REASON.revoked,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    await tx.delete(session).where(eq(session.userId, userId));
    await tx
      .delete(accountInvitation)
      .where(eq(accountInvitation.userId, userId));
    // A department with only revoked accounts must stay archivable.
    await tx
      .delete(departmentMember)
      .where(eq(departmentMember.userId, userId));
  });
}

export async function reinstateAccount(
  db: AnyDb,
  organizationId: string,
  input: ReinstateAccountInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const target = await targetOf(tx, organizationId, input.userId);
    if (accountStateOf(target) === 'revoked' && !input.password) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: translate('accounts.error.passwordRequired'),
      });
    }
    if (input.password) await setPassword(tx, input.userId, input.password);
    await tx
      .update(user)
      .set({
        banned: false,
        banReason: null,
        updatedAt: new Date(),
        ...(input.password ? { passwordChangeRequiredAt: new Date() } : {}),
      })
      .where(eq(user.id, input.userId));
  });
}

export async function resetAccountPassword(
  db: AnyDb,
  organizationId: string,
  input: ResetAccountPasswordInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await targetOf(tx, organizationId, input.userId);
    await setPassword(tx, input.userId, input.password);
    // Handed over by an admin: changed at the next sign-in. Sessions already open are not concerned.
    await tx
      .update(user)
      .set({ passwordChangeRequiredAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, input.userId));
    if (input.closeSessions) {
      await tx.delete(session).where(eq(session.userId, input.userId));
    }
  });
}
