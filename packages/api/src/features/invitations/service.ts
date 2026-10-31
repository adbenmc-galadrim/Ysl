import { CREDENTIAL_PROVIDER, setPassword, verifyPassword } from '@repo/auth/password';
import {
  accountStateOf,
  type InvitationView,
  type InviteCompanyAdminOutput,
  type LinkDelivery,
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
  user,
} from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { TRPCError } from '@trpc/server';
import { and, count, eq, gt, isNull, sql } from 'drizzle-orm';
import { deliverLink } from '#features/invitations/delivery';
import { hashToken, issueLink } from '#features/invitations/link';
import { type JournalActor, recordPlatformAction } from '#features/platform/journal';
import { sqlState } from '#features/sync/errors';

const translate = createTranslator(DEFAULT_LOCALE);

const UNIQUE_VIOLATION = '23505';
const ADMIN_ROLE = 'company_admin';

/** For filters on a query that joins `user`: Drizzle writes no table prefix on a single table. */
export const HAS_PASSWORD = sql`exists (select 1 from "account" where "account"."user_id" = "user"."id" and "account"."provider_id" = ${CREDENTIAL_PROVIDER})`;

async function hasCredential(db: AnyDb, userId: string): Promise<boolean> {
  const [found] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, CREDENTIAL_PROVIDER),
      ),
    );
  return Boolean(found);
}

/** What the page says, or why the link is refused. Nothing about an account without the live token. */
export async function inspectInvitation(
  db: AnyDb,
  token: string,
  now = new Date(),
): Promise<InvitationView> {
  const [row] = await db
    .select({
      userId: accountInvitation.userId,
      expiresAt: accountInvitation.expiresAt,
      usedAt: accountInvitation.usedAt,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      companyName: organization.name,
      departmentName: department.name,
    })
    .from(accountInvitation)
    .innerJoin(user, eq(user.id, accountInvitation.userId))
    .innerJoin(
      organization,
      eq(organization.id, accountInvitation.organizationId),
    )
    .leftJoin(departmentMember, eq(departmentMember.userId, user.id))
    .leftJoin(department, eq(department.id, departmentMember.departmentId))
    .where(eq(accountInvitation.tokenHash, hashToken(token)));
  if (!row || row.banned) return { state: 'invalid' };
  if (row.usedAt) return { state: 'used' };
  if (row.expiresAt <= now) return { state: 'expired' };
  return {
    state: 'valid',
    kind: (await hasCredential(db, row.userId)) ? 'reset' : 'invite',
    name: row.name,
    email: row.email,
    role: toUserRole(row.role),
    departmentName: row.departmentName,
    companyName: row.companyName,
    expiresAt: row.expiresAt,
  };
}

function refused(state: 'expired' | 'used' | 'invalid'): TRPCError {
  return new TRPCError({
    code: 'BAD_REQUEST',
    message: translate(`invitations.error.${state}`),
  });
}

/**
 * Claims the link by one update, so two tabs cannot both pass. Sessions stay
 * open: a phone whose owner forgot the password must not lose its photos.
 */
export async function acceptInvitation(
  db: AnyDb,
  { token, password }: { token: string; password: string },
  now = new Date(),
): Promise<void> {
  const tokenHash = hashToken(token);
  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(accountInvitation)
      .set({ usedAt: now })
      .where(
        and(
          eq(accountInvitation.tokenHash, tokenHash),
          isNull(accountInvitation.usedAt),
          gt(accountInvitation.expiresAt, now),
        ),
      )
      .returning({ userId: accountInvitation.userId });
    if (!claimed) {
      const view = await inspectInvitation(tx, token, now);
      throw refused(view.state === 'valid' ? 'invalid' : view.state);
    }
    const [target] = await tx
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, claimed.userId));
    if (!target || target.banned) throw refused('invalid');
    await setPassword(tx, claimed.userId, password);
    await tx
      .update(user)
      .set({ passwordChangeRequiredAt: null, updatedAt: now })
      .where(eq(user.id, claimed.userId));
  });
}

/** The password an admin handed over, replaced by the one who received it. */
export async function changeRequiredPassword(
  db: AnyDb,
  userId: string,
  password: string,
): Promise<void> {
  const [current] = await db
    .select({ hash: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, CREDENTIAL_PROVIDER),
      ),
    );
  if (current?.hash && (await verifyPassword({ hash: current.hash, password }))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: translate('invitations.error.samePassword'),
    });
  }
  await db.transaction(async (tx) => {
    await setPassword(tx, userId, password);
    await tx
      .update(user)
      .set({ passwordChangeRequiredAt: null, updatedAt: new Date() })
      .where(eq(user.id, userId));
  });
}

/**
 * §3.7.9: a company left without a working admin gets one from the app's admin,
 * who types a name and an address and reads back nothing of the company (D26).
 * The same address again gives a new link: a first link lost, or a revoked admin
 * coming back, whose old password dies here so that only the link lets it in. A
 * suspended admin keeps open sessions the link would not touch: refused, like
 * any other existing address. That refusal tells an address has an account: the
 * typo must show, so it stays, and each one goes to the journal, address left out.
 */
export async function inviteCompanyAdmin(
  db: AnyDb,
  input: InviteCompanyAdminOutput,
  actor: JournalActor,
): Promise<LinkDelivery> {
  const { organizationId, name, email } = input;
  let link: Awaited<ReturnType<typeof issueLink>>;
  let companyName = '';
  const emailTaken = () =>
    new TRPCError({
      code: 'CONFLICT',
      message: translate('accounts.error.emailTaken'),
    });
  let taken = false;
  try {
    link = await db.transaction(async (tx) => {
      const [company] = await tx
        .select({
          id: organization.id,
          name: organization.name,
          suspendedAt: organization.suspendedAt,
        })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .for('update');
      if (!company) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: translate('invitations.error.companyNotFound'),
        });
      }
      companyName = company.name;
      if (company.suspendedAt) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: translate('invitations.error.companySuspended'),
        });
      }
      const [active] = await tx
        .select({ total: count() })
        .from(organizationMember)
        .innerJoin(user, eq(user.id, organizationMember.userId))
        .where(
          and(
            eq(organizationMember.organizationId, organizationId),
            eq(user.role, ADMIN_ROLE),
            sql`${user.banned} is not true`,
            HAS_PASSWORD,
          ),
        );
      if (active?.total) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: translate('invitations.error.companyHasAdmin'),
        });
      }
      // A link sent to a wrong address must not stay good: nobody here can see or revoke it (D26).
      await tx.delete(accountInvitation).where(
        and(
          eq(accountInvitation.organizationId, organizationId),
          sql`${accountInvitation.userId} in (select "user"."id" from "user" where "user"."role" = ${ADMIN_ROLE} and not ${HAS_PASSWORD})`,
        ),
      );
      const [existing] = await tx
        .select({
          id: user.id,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          organizationId: organizationMember.organizationId,
        })
        .from(user)
        .leftJoin(organizationMember, eq(organizationMember.userId, user.id))
        .where(eq(user.email, email));
      if (!existing) {
        const userId = newId();
        await tx
          .insert(user)
          .values({ id: userId, name, email, role: ADMIN_ROLE });
        await tx.insert(organizationMember).values({ userId, organizationId });
        await recordPlatformAction(
          tx,
          actor,
          { id: organizationId, name: company.name },
          'company_admin_invited',
        );
        return issueLink(tx, { userId, organizationId });
      }
      if (
        existing.role !== ADMIN_ROLE ||
        existing.organizationId !== organizationId ||
        accountStateOf(existing) === 'suspended'
      ) {
        taken = true;
        throw emailTaken();
      }
      await tx.delete(account).where(eq(account.userId, existing.id));
      await tx
        .update(user)
        .set({ banned: false, banReason: null, updatedAt: new Date() })
        .where(eq(user.id, existing.id));
      await recordPlatformAction(
        tx,
        actor,
        { id: organizationId, name: company.name },
        'company_admin_invited',
      );
      return issueLink(tx, { userId: existing.id, organizationId });
    });
  } catch (error) {
    if (!taken && sqlState(error) !== UNIQUE_VIOLATION) throw error;
    // Outside the transaction just undone, which would take the line with it.
    await recordPlatformAction(
      db,
      actor,
      { id: organizationId, name: companyName },
      'company_admin_invite_refused',
    );
    throw emailTaken();
  }
  return deliverLink(
    db,
    { organizationId, name, email, role: ADMIN_ROLE, kind: 'invite' },
    link,
    { copy: input.copy },
  );
}
