import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { credentialRow, verifyPassword } from '@repo/auth/password';
import type { Session } from '@repo/auth';
import * as schema from '@repo/db/schema';
import { eq } from 'drizzle-orm';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});
const env = vi.hoisted((): Record<string, string | undefined> => ({
  BREVO_API_KEY: undefined,
  MAIL_FROM_ADDRESS: undefined,
  MAIL_FROM_NAME: 'Courrier',
  CORS_ORIGIN: 'https://app.test',
  LOG_LEVEL: 'error',
  NODE_ENV: 'test',
}));

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));
vi.mock('@repo/shared/env/server', () => ({ env }));

const { callerFor, codeOf, sessionFor } = await import('./helpers/caller');
const { ORGANIZATION_ID, OTHER_ORGANIZATION_ID } =
  await import('./helpers/pglite');
const { startFakeBrevo } = await import('./helpers/fake-brevo');
const { appRouter } = await import('#root');
const { issueLink, hashToken } = await import('#features/invitations/link');
const { deliverLink } = await import('#features/invitations/delivery');
const { brevoMailer } = await import('#features/mail/brevo');
const { newId } = await import('@repo/shared/id');
const { purgeCompanyRows } = await import('#features/platform/purge-company');

const ADMIN = 'inv-admin';
const PLATFORM = 'inv-platform';
const PASSWORD = 'un-long-mot-de-passe';

function sessionOf(userId: string, role: string): Session {
  const base = sessionFor(role);
  return {
    session: { ...base.session, userId },
    user: { ...base.user, id: userId, name: 'Claire Bonnet' },
  };
}
const admin = () => callerFor(sessionOf(ADMIN, 'company_admin'));
const platform = () => callerFor(sessionOf(PLATFORM, 'platform_admin'));
const anyone = () => callerFor(null);

const tokenOf = (link: string) => link.split('#')[1] ?? '';

async function invite(email = 'nadia@example.test') {
  const { account, link } = await admin().accounts.create({
    name: 'Nadia Kessler',
    email,
    role: 'shuttle',
    departmentId: null,
  });
  if (link.delivery !== 'copy') throw new Error('no link');
  return { account, link, token: tokenOf(link.link) };
}

async function rowOf(userId: string) {
  const [row] = await db
    .select()
    .from(schema.accountInvitation)
    .where(eq(schema.accountInvitation.userId, userId));
  return row;
}

async function hashOf(userId: string) {
  const [row] = await db
    .select({ password: schema.account.password })
    .from(schema.account)
    .where(eq(schema.account.userId, userId));
  return row?.password ?? '';
}

beforeEach(async () => {
  env.BREVO_API_KEY = undefined;
  env.MAIL_FROM_ADDRESS = undefined;
  await db.delete(schema.user);
  await db.insert(schema.user).values([
    { id: ADMIN, name: 'Claire', email: 'claire@example.test', role: 'company_admin' },
    { id: PLATFORM, name: 'App', email: 'app@example.test', role: 'platform_admin' },
  ]);
  await db
    .insert(schema.organizationMember)
    .values({ userId: ADMIN, organizationId: ORGANIZATION_ID });
  await db.insert(schema.account).values(await credentialRow(ADMIN, PASSWORD));
});

afterAll(async () => {
  await client.close();
});

describe('the link', () => {
  it('stores only a hash, and hands the token over in the fragment', async () => {
    const { account, link, token } = await invite();
    expect(link.reason).toBe('off');
    expect(link.link).toBe(`https://app.test/invitation#${token}`);
    const row = await rowOf(account.id);
    expect(row?.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row?.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 6.9 * 24 * 3600 * 1000,
    );
  });

  it('reads its account back, and opens nothing before it is used', async () => {
    const { account, token } = await invite();
    expect(await anyone().invitations.inspect({ token })).toMatchObject({
      state: 'valid',
      kind: 'invite',
      name: 'Nadia Kessler',
      email: 'nadia@example.test',
      role: 'shuttle',
    });
    expect(await hashOf(account.id)).toBe('');
  });

  it('sets the password once, then refuses to serve again', async () => {
    const { account, token } = await invite();
    await anyone().invitations.accept({ token, password: PASSWORD });
    expect(
      await verifyPassword({ hash: await hashOf(account.id), password: PASSWORD }),
    ).toBe(true);
    expect(await anyone().invitations.inspect({ token })).toEqual({ state: 'used' });
    expect(
      await codeOf(anyone().invitations.accept({ token, password: 'encore-un-autre-mdp' })),
    ).toBe('BAD_REQUEST');
    expect(
      await verifyPassword({ hash: await hashOf(account.id), password: PASSWORD }),
    ).toBe(true);
    const { rows } = await admin().accounts.list({ state: 'active' });
    expect(rows.map((row) => row.id)).toContain(account.id);
  });

  it('lets one of two simultaneous uses pass', async () => {
    const { token } = await invite();
    const results = await Promise.allSettled([
      anyone().invitations.accept({ token, password: PASSWORD }),
      anyone().invitations.accept({ token, password: 'encore-un-autre-mdp' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('refuses it once expired', async () => {
    const { account, token } = await invite();
    await db
      .update(schema.accountInvitation)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.accountInvitation.userId, account.id));
    expect(await anyone().invitations.inspect({ token })).toEqual({ state: 'expired' });
    expect(
      await codeOf(anyone().invitations.accept({ token, password: PASSWORD })),
    ).toBe('BAD_REQUEST');
    expect(await hashOf(account.id)).toBe('');
  });

  it('refuses the old one when a new one is sent', async () => {
    const { account, token } = await invite();
    const sent = await admin().accounts.sendLink({ userId: account.id });
    expect(sent.delivery).toBe('copy');
    expect(await anyone().invitations.inspect({ token })).toEqual({ state: 'invalid' });
    await anyone().invitations.accept({
      token: sent.delivery === 'copy' ? tokenOf(sent.link) : '',
      password: PASSWORD,
    });
    expect(await hashOf(account.id)).not.toBe('');
  });

  it('refuses it for a suspended or revoked account', async () => {
    const { account, token } = await invite();
    await admin().accounts.suspend({ userId: account.id });
    expect(await anyone().invitations.inspect({ token })).toEqual({ state: 'invalid' });
    expect(
      await codeOf(anyone().invitations.accept({ token, password: PASSWORD })),
    ).toBe('BAD_REQUEST');
    expect(await hashOf(account.id)).toBe('');
    expect(await codeOf(admin().accounts.sendLink({ userId: account.id }))).toBe('BAD_REQUEST');
    await admin().accounts.revoke({ userId: account.id });
    expect(await rowOf(account.id)).toBeUndefined();
  });

  it('refuses a short password', async () => {
    const { token } = await invite();
    expect(
      await codeOf(anyone().invitations.accept({ token, password: 'court' })),
    ).toBe('BAD_REQUEST');
  });

  it('keeps the sessions of a forgotten password, and lifts the forced change', async () => {
    await db.insert(schema.session).values({
      id: 'phone',
      token: 'phone-token',
      userId: ADMIN,
      expiresAt: new Date('2099-01-01'),
      updatedAt: new Date(),
    });
    await db
      .update(schema.user)
      .set({ passwordChangeRequiredAt: new Date() })
      .where(eq(schema.user.id, ADMIN));
    const { token } = await issueLink(db, {
      userId: ADMIN,
      organizationId: ORGANIZATION_ID,
    });
    expect(await anyone().invitations.inspect({ token })).toMatchObject({ kind: 'reset' });
    await anyone().invitations.accept({ token, password: 'un-tout-nouveau-mdp' });
    const sessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, ADMIN));
    expect(sessions).toHaveLength(1);
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, ADMIN));
    expect(row?.passwordChangeRequiredAt).toBeNull();
  });

  it('goes when its company is purged', async () => {
    const organizationId = newId();
    await db
      .insert(schema.organization)
      .values({ id: organizationId, name: 'À supprimer' });
    await db.insert(schema.user).values({
      id: 'inv-gone',
      name: 'Gone',
      email: 'gone@example.test',
      role: 'shuttle',
    });
    await db
      .insert(schema.organizationMember)
      .values({ userId: 'inv-gone', organizationId });
    await issueLink(db, { userId: 'inv-gone', organizationId });
    await purgeCompanyRows(db, organizationId);
    expect(await rowOf('inv-gone')).toBeUndefined();
  });

  it('never carries the token in a URL', () => {
    const { procedures } = appRouter._def;
    const typeOf = (path: string) =>
      (procedures as unknown as Record<string, { _def: { type: string } }>)[path]?._def.type;
    expect(typeOf('invitations.inspect')).toBe('mutation');
    expect(typeOf('invitations.accept')).toBe('mutation');
  });

  it('goes with its company', async () => {
    const foreignKeys = await client.query<{ confdeltype: string }>(
      `select confdeltype from pg_constraint where conrelid = 'account_invitation'::regclass and confrelid = 'organization'::regclass`,
    );
    expect(foreignKeys.rows).toEqual([{ confdeltype: 'c' }]);
  });
});

describe('sending', () => {
  const message = {
    organizationId: ORGANIZATION_ID,
    name: 'Nadia <b>',
    email: 'nadia@example.test',
    role: 'shuttle',
    kind: 'invite' as const,
    invitedBy: 'Claire Bonnet',
  };
  const link = { token: 'le-jeton', expiresAt: new Date('2099-01-01') };

  it('sends the mail and gives no link when the provider accepts', async () => {
    const brevo = await startFakeBrevo();
    const mailer = brevoMailer({
      apiKey: 'test-key',
      from: { email: 'plateforme@example.test', name: 'Courrier' },
      fetch: brevo.fetch,
    });
    const result = await deliverLink(db, message, link, { mailer });
    expect(result).toEqual({ delivery: 'sent', expiresAt: link.expiresAt });
    const [mail] = brevo.sent;
    expect(mail?.to[0]?.email).toBe('nadia@example.test');
    expect(mail?.textContent).toContain('https://app.test/invitation#le-jeton');
    expect(mail?.textContent).toContain('Claire Bonnet');
    expect(mail?.htmlContent).toContain('href="https://app.test/invitation#le-jeton"');
    await brevo.close();
  });

  it('gives the link when the provider refuses, and leaves it out of the database', async () => {
    const brevo = await startFakeBrevo();
    const mailer = brevoMailer({
      apiKey: 'wrong-key',
      from: { email: 'plateforme@example.test', name: 'Courrier' },
      fetch: brevo.fetch,
    });
    const result = await deliverLink(db, message, link, { mailer });
    expect(result).toMatchObject({ delivery: 'copy', reason: 'failed' });
    const queued = await db.select().from(schema.emailOutbox);
    expect(JSON.stringify(queued)).not.toContain('le-jeton');
    await brevo.close();
  });

  it('gives the link on request, without sending', async () => {
    const send = vi.fn();
    const result = await deliverLink(db, message, link, {
      copy: true,
      mailer: { send },
    });
    expect(result).toMatchObject({ delivery: 'copy', reason: 'asked' });
    expect(send).not.toHaveBeenCalled();
  });

  it('survives a provider that throws', async () => {
    const result = await deliverLink(db, message, link, {
      mailer: { send: () => Promise.reject(new Error('down')) },
    });
    expect(result).toMatchObject({ delivery: 'copy', reason: 'failed' });
  });
});

describe('the forced change', () => {
  const required = async (at: Date, sessionAt: Date) => {
    await db
      .update(schema.user)
      .set({ passwordChangeRequiredAt: at })
      .where(eq(schema.user.id, ADMIN));
    const base = sessionOf(ADMIN, 'company_admin');
    return callerFor({
      session: { ...base.session, createdAt: sessionAt },
      user: { ...base.user, passwordChangeRequiredAt: at },
    });
  };

  it('leaves a session opened before the request alone', async () => {
    const caller = await required(new Date(), new Date(Date.now() - 60_000));
    await expect(caller.accounts.list({})).resolves.toBeDefined();
    expect(
      await codeOf(caller.invitations.changeRequiredPassword({ password: PASSWORD })),
    ).toBe('FORBIDDEN');
  });

  it('blocks a session opened after it until the password changes', async () => {
    const caller = await required(new Date(Date.now() - 60_000), new Date());
    expect(await codeOf(caller.accounts.list({}))).toBe('FORBIDDEN');
    await caller.invitations.changeRequiredPassword({
      password: 'un-tout-nouveau-mdp',
    });
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, ADMIN));
    expect(row?.passwordChangeRequiredAt).toBeNull();
    expect(
      await verifyPassword({ hash: await hashOf(ADMIN), password: 'un-tout-nouveau-mdp' }),
    ).toBe(true);
  });

  it('refuses the password that was handed over', async () => {
    const caller = await required(new Date(Date.now() - 60_000), new Date());
    expect(
      await codeOf(caller.invitations.changeRequiredPassword({ password: PASSWORD })),
    ).toBe('BAD_REQUEST');
  });

  it('never concerns an account nobody asked it of', async () => {
    const caller = admin();
    await expect(caller.accounts.list({})).resolves.toBeDefined();
  });
});

describe('the app admin', () => {
  const input = {
    organizationId: OTHER_ORGANIZATION_ID,
    name: 'Léa Martin',
    email: 'lea@example.test',
  };

  it('invites the first admin of a company, and reads back nothing nominative', async () => {
    const result = await platform().invitations.inviteCompanyAdmin(input);
    expect(result).toMatchObject({ delivery: 'copy', reason: 'off' });
    expect(JSON.stringify(result)).not.toContain('lea@example.test');
    expect(JSON.stringify(result)).not.toContain('Léa');
    const [created] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, 'lea@example.test'));
    expect(created?.role).toBe('company_admin');
    const [member] = await db
      .select()
      .from(schema.organizationMember)
      .where(eq(schema.organizationMember.userId, created?.id ?? ''));
    expect(member?.organizationId).toBe(OTHER_ORGANIZATION_ID);
  });

  it('is refused while the company has a working admin', async () => {
    expect(
      await codeOf(
        platform().invitations.inviteCompanyAdmin({
          ...input,
          organizationId: ORGANIZATION_ID,
        }),
      ),
    ).toBe('CONFLICT');
  });

  it('gives a new link to the same admin, the old one stops working', async () => {
    const first = await platform().invitations.inviteCompanyAdmin(input);
    const again = await platform().invitations.inviteCompanyAdmin(input);
    if (first.delivery !== 'copy' || again.delivery !== 'copy') throw new Error();
    expect(
      await anyone().invitations.inspect({ token: tokenOf(first.link) }),
    ).toEqual({ state: 'invalid' });
    expect(
      await anyone().invitations.inspect({ token: tokenOf(again.link) }),
    ).toMatchObject({ state: 'valid', role: 'company_admin' });
  });

  it('takes a revoked admin back only through the link, the old password dead', async () => {
    await db
      .update(schema.user)
      .set({ banned: true, banReason: 'revoked' })
      .where(eq(schema.user.id, ADMIN));
    const result = await platform().invitations.inviteCompanyAdmin({
      ...input,
      email: 'claire@example.test',
      organizationId: ORGANIZATION_ID,
    });
    if (result.delivery !== 'copy') throw new Error();
    expect(await hashOf(ADMIN)).toBe('');
    expect(
      await anyone().invitations.inspect({ token: tokenOf(result.link) }),
    ).toMatchObject({ state: 'valid', kind: 'invite' });
  });

  it('leaves a suspended admin suspended, and takes another address', async () => {
    await db
      .update(schema.user)
      .set({ banned: true, banReason: 'suspended' })
      .where(eq(schema.user.id, ADMIN));
    expect(
      await codeOf(
        platform().invitations.inviteCompanyAdmin({
          ...input,
          email: 'claire@example.test',
          organizationId: ORGANIZATION_ID,
        }),
      ),
    ).toBe('CONFLICT');
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, ADMIN));
    expect(row?.banned).toBe(true);
    await expect(
      platform().invitations.inviteCompanyAdmin({
        ...input,
        organizationId: ORGANIZATION_ID,
      }),
    ).resolves.toBeDefined();
  });

  it('refuses an address that belongs elsewhere, without saying where', async () => {
    expect(
      await codeOf(
        platform().invitations.inviteCompanyAdmin({
          ...input,
          email: 'claire@example.test',
        }),
      ),
    ).toBe('CONFLICT');
    expect(
      await codeOf(
        platform().invitations.inviteCompanyAdmin({ ...input, email: 'app@example.test' }),
      ),
    ).toBe('CONFLICT');
  });

  it('is the only one who can', async () => {
    expect(
      await codeOf(admin().invitations.inviteCompanyAdmin(input)),
    ).toBe('FORBIDDEN');
    expect(
      await codeOf(anyone().invitations.inviteCompanyAdmin(input)),
    ).toBe('UNAUTHORIZED');
  });
});
