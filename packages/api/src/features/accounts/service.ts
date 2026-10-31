import { credentialRow, setPassword } from '@repo/auth/password';
import {
  ACCOUNTS_PAGE_SIZE,
  type AccountRecord,
  accountStateOf,
  BAN_REASON,
  type CreateAccountInput,
  type ListAccountsInput,
  type ListAccountsOutput,
  type ReinstateAccountInput,
  type ResetAccountPasswordInput,
  type SetAccountRoleInput,
} from '@repo/contract/accounts';
import { toUserRole } from '@repo/contract/auth';
import type { AnyDb } from '@repo/db';
import {
  account,
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
  or,
  sql,
} from 'drizzle-orm';
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

function escapeLike(value: string): string {
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
      state: accountStateOf(row),
      lastSignInAt: last,
      deviceAgents: own
        .filter((entry) => entry.expiresAt > now)
        .map((entry) => entry.userAgent),
    };
  });
}

function stateFilter(state: ListAccountsInput['state']) {
  switch (state) {
    case 'active':
      return or(isNull(user.banned), eq(user.banned, false));
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

/** Written here rather than by Better Auth's admin API, which ignores companies: all or nothing. */
export async function createAccount(
  db: AnyDb,
  organizationId: string,
  input: CreateAccountInput,
): Promise<AccountRecord> {
  const userId = newId();
  const credential = await credentialRow(userId, input.password);
  const email = input.email.toLowerCase();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: input.name,
        email,
        role: input.role,
      });
      await tx.insert(account).values(credential);
      await tx.insert(organizationMember).values({ userId, organizationId });
      if (input.departmentId) {
        await requireDepartment(tx, organizationId, input.departmentId);
        await tx.insert(departmentMember).values({
          userId,
          organizationId,
          departmentId: input.departmentId,
        });
      }
    });
  } catch (error) {
    if (sqlState(error) !== UNIQUE_VIOLATION) throw error;
    throw new TRPCError({
      code: 'CONFLICT',
      message: translate('accounts.error.emailTaken'),
    });
  }
  return getAccountRecord(db, organizationId, userId);
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
  const target = await targetOf(db, organizationId, input.userId);
  if (accountStateOf(target) === 'revoked' && !input.password) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: translate('accounts.error.passwordRequired'),
    });
  }
  if (input.password) await setPassword(db, input.userId, input.password);
  await db
    .update(user)
    .set({ banned: false, banReason: null, updatedAt: new Date() })
    .where(eq(user.id, input.userId));
}

export async function resetAccountPassword(
  db: AnyDb,
  organizationId: string,
  input: ResetAccountPasswordInput,
): Promise<void> {
  await targetOf(db, organizationId, input.userId);
  await setPassword(db, input.userId, input.password);
  if (input.closeSessions) {
    await db.delete(session).where(eq(session.userId, input.userId));
  }
}
