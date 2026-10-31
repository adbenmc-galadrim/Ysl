import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { emailOutbox, mailSender } from '@repo/db/schema';
import type { DomainResult, MailDomains } from '#features/mail/mailer';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});
const env = vi.hoisted((): Record<string, string | undefined> => ({
  BREVO_API_KEY: 'test-key',
  MAIL_FROM_ADDRESS: 'notifications@plateforme.test',
  LOG_LEVEL: 'error',
  NODE_ENV: 'test',
}));

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));
vi.mock('@repo/shared/env/server', () => ({ env }));

const { callerFor, sessionFor } = await import('./helpers/caller');
const { AGENT_ID, STRANGER_ID, ORGANIZATION_ID } =
  await import('./helpers/pglite');
const { startFakeBrevo } = await import('./helpers/fake-brevo');
const { brevoMailer } = await import('#features/mail/brevo');
const { drainEmailOutbox, enqueueEmail } = await import('#features/mail/queue');
const { checkSender, saveSender } = await import('#features/mail/sender');

function callerAs(userId: string, role: string) {
  const session = sessionFor(role);
  session.user.id = userId;
  return callerFor(session);
}
const admin = () => callerAs(AGENT_ID, 'company_admin');
const otherAdmin = () => callerAs(STRANGER_ID, 'company_admin');
const RECORD = {
  kind: 'dkim' as const,
  type: 'TXT',
  host: 'mail._domainkey',
  value: 'k=rsa',
  configured: false,
};
const SENDER = { name: 'Courrier Lumen', email: 'courrier@lumen.test' };

let brevo: Awaited<ReturnType<typeof startFakeBrevo>>;
let toFake: typeof globalThis.fetch;

async function sentFrom(key: string) {
  await enqueueEmail(db, {
    idempotencyKey: key,
    organizationId: ORGANIZATION_ID,
    to: 'camille@example.test',
    subject: 'Colis',
    text: 'Bonjour',
  });
  await drainEmailOutbox(
    db,
    brevoMailer({
      apiKey: 'test-key',
      from: { email: 'notifications@plateforme.test', name: 'Courrier' },
      fetch: brevo.fetch,
    }),
  );
  return brevo.sent.at(-1)?.sender;
}

beforeAll(async () => {
  brevo = await startFakeBrevo();
  const real = globalThis.fetch;
  toFake = (input, init) =>
    (input as string).startsWith('https://api.brevo.com')
      ? brevo.fetch(input, init)
      : real(input, init);
  vi.stubGlobal('fetch', toFake);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await brevo.close();
  await client.close();
});

beforeEach(async () => {
  env.BREVO_API_KEY = 'test-key';
  brevo.domains.clear();
  await db.delete(emailOutbox);
  await db.delete(mailSender);
});

describe('company sender', () => {
  it('goes from the platform address to its own once the domain is verified', async () => {
    const saved = await admin().mailSender.save(SENDER);
    expect(saved.sender).toMatchObject({
      domain: 'lumen.test',
      status: 'pending',
    });
    expect(saved.sender?.records.map((r) => r.kind)).toEqual([
      'code',
      'dkim',
      'dmarc',
    ]);
    expect(await sentFrom('m1')).toEqual({
      email: 'notifications@plateforme.test',
      name: 'Courrier Lumen',
    });

    expect((await admin().mailSender.check()).sender?.status).toBe('pending');
    expect(await sentFrom('m2')).toMatchObject({
      email: 'notifications@plateforme.test',
    });

    brevo.publish('lumen.test');
    const checked = await admin().mailSender.check();
    expect(checked.sender?.status).toBe('verified');
    expect(checked.sender?.verifiedAt).toBeInstanceOf(Date);
    expect(await sentFrom('m3')).toEqual(SENDER);
  });

  it('sends in the company name when it set nothing', async () => {
    expect(await sentFrom('m1')).toEqual({
      email: 'notifications@plateforme.test',
      name: 'Service courrier',
    });
  });

  it('falls back again when the domain changes, and frees the old one', async () => {
    await admin().mailSender.save(SENDER);
    brevo.publish('lumen.test');
    await admin().mailSender.check();

    await admin().mailSender.save({
      name: 'Courrier Lumen',
      email: 'courrier@autre.test',
    });

    expect(await sentFrom('m1')).toMatchObject({
      email: 'notifications@plateforme.test',
    });
    expect(brevo.domains.has('lumen.test')).toBe(false);
    expect(brevo.domains.has('autre.test')).toBe(true);
  });

  it('stays verified when only the name or the local part changes', async () => {
    await admin().mailSender.save(SENDER);
    brevo.publish('lumen.test');
    await admin().mailSender.check();

    const saved = await admin().mailSender.save({
      name: 'Lumen',
      email: 'avis@LUMEN.test',
    });

    expect(saved.sender?.status).toBe('verified');
    expect(await sentFrom('m1')).toEqual({
      name: 'Lumen',
      email: 'avis@LUMEN.test',
    });
  });

  it('goes back to the fallback when a new check finds the DNS gone', async () => {
    await admin().mailSender.save(SENDER);
    brevo.publish('lumen.test');
    await admin().mailSender.check();
    brevo.domains.set('lumen.test', { published: false, authenticated: false });

    expect((await admin().mailSender.check()).sender).toMatchObject({
      status: 'pending',
      verifiedAt: null,
    });
    expect(await sentFrom('m1')).toMatchObject({
      email: 'notifications@plateforme.test',
    });
  });
});

describe('who may claim a domain', () => {
  it('refuses a domain another company holds', async () => {
    await admin().mailSender.save(SENDER);

    await expect(otherAdmin().mailSender.save(SENDER)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect((await otherAdmin().mailSender.get()).sender).toBeNull();
  });

  it('refuses a domain already authenticated at the provider with no owner here', async () => {
    brevo.domains.set('lumen.test', { published: true, authenticated: true });

    await expect(admin().mailSender.save(SENDER)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect((await admin().mailSender.get()).sender).toBeNull();
  });

  it('does not verify through a key added later if the domain is already authenticated', async () => {
    env.BREVO_API_KEY = undefined;
    await admin().mailSender.save(SENDER);
    env.BREVO_API_KEY = 'test-key';
    brevo.domains.set('lumen.test', { published: true, authenticated: true });

    const checked = await admin().mailSender.check();

    expect(checked.problem).toBe('taken');
    expect(checked.sender?.status).toBe('pending');
  });

  it('refuses the platform domain and a name the provider rejects', async () => {
    await expect(
      admin().mailSender.save({
        name: 'X',
        email: 'x@PLATEFORME.test',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      admin().mailSender.save({ name: 'X', email: 'x@nope.invalid' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it.each(['agent', 'shuttle', 'department', 'platform_admin'])(
    'is closed to the role %s',
    async (role) => {
      const caller = callerAs(AGENT_ID, role);
      await expect(caller.mailSender.get()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(caller.mailSender.save(SENDER)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(caller.mailSender.check()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );

  it('stays open to the former admin role', async () => {
    expect(
      (await callerAs(AGENT_ID, 'admin').mailSender.get()).sender,
    ).toBeNull();
  });
});

describe('without the provider', () => {
  it('counts a key without a sender address as not configured', async () => {
    env.MAIL_FROM_ADDRESS = undefined;
    const saved = await admin().mailSender.save(SENDER);
    env.MAIL_FROM_ADDRESS = 'notifications@plateforme.test';
    expect(saved.providerConfigured).toBe(false);
  });

  it('saves the sender and says the check is unavailable', async () => {
    env.BREVO_API_KEY = undefined;

    const saved = await admin().mailSender.save(SENDER);
    expect(saved.providerConfigured).toBe(false);
    expect(saved.sender).toMatchObject({ status: 'pending', records: [] });

    const checked = await admin().mailSender.check();
    expect(checked.problem).toBe('unavailable');
    expect(checked.sender?.status).toBe('pending');
  });

  it('declares the domain at the first check once the key is there', async () => {
    env.BREVO_API_KEY = undefined;
    await admin().mailSender.save(SENDER);
    env.BREVO_API_KEY = 'test-key';

    const checked = await admin().mailSender.check();

    expect(checked.problem).toBeNull();
    expect(checked.sender?.records).toHaveLength(3);
  });

  it('keeps the sender when the provider is down at save time', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('down')));
    const saved = await admin().mailSender.save(SENDER);
    expect(saved.problem).toBe('unavailable');
    expect(saved.sender?.status).toBe('pending');
    vi.stubGlobal('fetch', toFake);
  });
});

describe('the shared provider account', () => {
  const context = (provider: MailDomains) => ({
    provider,
    platformAddress: null,
  });
  const found = (authenticated: boolean, created = false): DomainResult => ({
    status: 'found',
    created,
    authenticated,
    records: [],
  });
  const fakeDomains = (over: Partial<MailDomains>): MailDomains => ({
    register: () => Promise.resolve(found(false, true)),
    check: () => Promise.resolve(found(false)),
    remove: vi.fn(() => Promise.resolve()),
    ...over,
  });
  const save = (provider: MailDomains, email: string) =>
    saveSender(
      db,
      {
        organizationId: ORGANIZATION_ID,
        userId: AGENT_ID,
        input: { name: 'Lumen', email },
      },
      context(provider),
    );

  it('does not verify a domain saved while the check of another one ran', async () => {
    const provider: MailDomains = fakeDomains({
      register: () =>
        Promise.resolve({ ...found(false, true), records: [RECORD] }),
      check: async () => {
        await save(provider, 'pdg@victime.test');
        return found(true);
      },
    });
    await save(provider, 'courrier@lumen.test');

    const result = await checkSender(
      db,
      { organizationId: ORGANIZATION_ID },
      context(provider),
    );

    expect(result.sender).toMatchObject({
      domain: 'victime.test',
      status: 'pending',
    });
  });

  it('removes only a domain this company declared or proved', async () => {
    const adopted = fakeDomains({
      register: () => Promise.resolve(found(false, false)),
    });
    await save(adopted, 'courrier@tiers.test');
    await save(adopted, 'courrier@suivant.test');
    expect(adopted.remove).not.toHaveBeenCalled();

    const own = fakeDomains({});
    await db.delete(mailSender);
    await save(own, 'courrier@lumen.test');
    await save(own, 'courrier@suivant.test');
    expect(own.remove).toHaveBeenCalledWith('lumen.test');
  });

  it('keeps the new sender when the old domain cannot be removed', async () => {
    const provider = fakeDomains({
      remove: () => Promise.reject(new Error('brevo 500')),
    });
    await save(provider, 'courrier@lumen.test');

    const result = await save(provider, 'courrier@suivant.test');

    expect(result).toMatchObject({ sender: { domain: 'suivant.test' } });
  });

  it('says a name refused once the key is there, not an outage', async () => {
    env.BREVO_API_KEY = undefined;
    await admin().mailSender.save({ name: 'X', email: 'x@nope.invalid' });
    env.BREVO_API_KEY = 'test-key';

    expect((await admin().mailSender.check()).problem).toBe('invalid');
  });
});
