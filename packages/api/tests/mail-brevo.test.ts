import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { brevoDomains, brevoMailer } from '#features/mail/brevo';
import { startFakeBrevo } from './helpers/fake-brevo';

const message = {
  idempotencyKey: 'invite:1',
  to: 'camille@example.test',
  toName: 'Camille',
  subject: 'Invitation',
  text: 'Bonjour',
};

function mailerAnswering(answer: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
  );
  return {
    fetch,
    mailer: brevoMailer({
      apiKey: 'test-key',
      from: { email: 'courrier@example.test', name: 'Courrier' },
      fetch,
    }),
  };
}

const json = (
  status: number,
  body: unknown,
  headers?: Record<string, string>,
) => new Response(JSON.stringify(body), { status, headers });

describe('brevo mailer', () => {
  it('posts the message with its key and returns the provider id', async () => {
    const { fetch, mailer } = mailerAnswering(
      json(201, { messageId: '<m1@relay>' }),
    );

    expect(await mailer.send(message)).toEqual({
      status: 'sent',
      providerMessageId: '<m1@relay>',
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(new Headers(init?.headers).get('api-key')).toBe('test-key');
    expect(JSON.parse(init?.body as string)).toEqual({
      sender: { email: 'courrier@example.test', name: 'Courrier' },
      to: [{ email: 'camille@example.test', name: 'Camille' }],
      subject: 'Invitation',
      textContent: 'Bonjour',
      headers: { IdempotencyKey: 'invite:1' },
    });
  });

  it.each([429, 500, 503])('retries on a %i', async (status) => {
    const { mailer } = mailerAnswering(json(status, { code: 'x' }));
    expect((await mailer.send(message)).status).toBe('retry');
  });

  it.each([401, 402, 403])('is blocked on a %i', async (status) => {
    const { mailer } = mailerAnswering(json(status, { code: 'x' }));
    expect((await mailer.send(message)).status).toBe('blocked');
  });

  it('retries when Brevo cannot be reached', async () => {
    const { mailer } = mailerAnswering(new TypeError('fetch failed'));
    expect(await mailer.send(message)).toEqual({
      status: 'retry',
      reason: 'brevo unreachable: TypeError',
    });
  });

  it('gives the wait Brevo asks for', async () => {
    const { mailer } = mailerAnswering(json(429, {}, { 'retry-after': '120' }));
    expect(await mailer.send(message)).toMatchObject({
      retryAfterMs: 120_000,
    });
  });

  it('rejects a bad request, without the address in the reason', async () => {
    const { mailer } = mailerAnswering(
      json(400, {
        code: 'invalid_parameter',
        message: 'camille@example.test is not valid',
      }),
    );
    expect(await mailer.send(message)).toEqual({
      status: 'rejected',
      reason: 'brevo 400 invalid_parameter',
    });
  });

  it('counts a duplicate as sent: the first attempt went through', async () => {
    const { mailer } = mailerAnswering(
      json(400, { code: 'duplicate_request' }),
    );
    expect(await mailer.send(message)).toEqual({
      status: 'sent',
      providerMessageId: null,
    });
  });
});

describe('brevo domains', () => {
  let brevo: Awaited<ReturnType<typeof startFakeBrevo>>;
  let domains: ReturnType<typeof brevoDomains>;

  beforeAll(async () => {
    brevo = await startFakeBrevo();
    domains = brevoDomains({ apiKey: 'test-key', fetch: brevo.fetch });
  });
  afterAll(() => brevo.close());

  it('declares a domain, then authenticates it once the DNS is in place', async () => {
    const created = await domains.register('lumen.test');
    expect(created).toMatchObject({
      status: 'found',
      created: true,
      authenticated: false,
    });
    expect(created.status === 'found' && created.records[0]).toEqual({
      kind: 'code',
      type: 'TXT',
      host: '@',
      value: 'brevo-code:1',
      configured: false,
    });

    expect(await domains.check('lumen.test')).toMatchObject({
      authenticated: false,
    });
    brevo.publish('lumen.test');
    expect(await domains.check('lumen.test')).toMatchObject({
      authenticated: true,
    });
  });

  it('tells a domain already declared from a refused name', async () => {
    expect(await domains.register('lumen.test')).toMatchObject({
      status: 'found',
      created: false,
    });
    expect(await domains.register('nope.invalid')).toEqual({
      status: 'invalid',
    });
    expect(await domains.check('absent.test')).toEqual({ status: 'notFound' });
  });

  it('reports a refused key or an unreachable provider as unavailable', async () => {
    const refused = brevoDomains({ apiKey: 'wrong', fetch: brevo.fetch });
    expect(await refused.register('other.test')).toMatchObject({
      status: 'unavailable',
      reason: 'brevo 401',
    });
    const down = brevoDomains({
      apiKey: 'test-key',
      fetch: () => Promise.reject(new TypeError('down')),
    });
    expect(await down.check('other.test')).toEqual({
      status: 'unavailable',
      reason: 'brevo unreachable: TypeError',
    });
  });

  it('treats an unreadable answer as an outage, not as unverified', async () => {
    const garbled = brevoDomains({
      apiKey: 'test-key',
      fetch: (_, init) =>
        Promise.resolve(
          new Response(init?.method === 'GET' ? 'oops' : '{}', { status: 200 }),
        ),
    });
    expect(await garbled.check('x.test')).toEqual({
      status: 'unavailable',
      reason: 'brevo unreadable',
    });
  });

  it('reports a removal the provider refused', async () => {
    const refusing = brevoDomains({
      apiKey: 'test-key',
      fetch: () => Promise.resolve(new Response('{}', { status: 500 })),
    });
    await expect(refusing.remove('x.test')).rejects.toThrow('brevo 500');
  });

  it('reads any record name the account uses', async () => {
    const answer = new Response(
      JSON.stringify({
        authenticated: false,
        dns_records: {
          sendinblue_code: { host_name: '@', type: 'TXT', value: 'code' },
          spf_record: { host_name: '@', type: 'TXT', value: 'v=spf1' },
          dkim2Record: {
            host_name: 'b',
            type: 'CNAME',
            value: 'x',
            status: true,
          },
          empty: null,
        },
      }),
    );
    const other = brevoDomains({
      apiKey: 'test-key',
      fetch: (_, init) =>
        Promise.resolve(
          init?.method === 'GET' ? answer : new Response('{}', { status: 400 }),
        ),
    });
    const result = await other.check('x.test');
    expect(
      result.status === 'found' && result.records.map((r) => r.kind),
    ).toEqual(['code', 'spf', 'dkim']);
  });
});
