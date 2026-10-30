import { describe, expect, it, vi } from 'vitest';
import { brevoMailer } from '#features/mail/brevo';

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

const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

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

  it.each([401, 402, 403, 429, 500, 503])(
    'retries on a %i: not the message’s fault',
    async (status) => {
      const { mailer } = mailerAnswering(json(status, { code: 'x' }));
      expect((await mailer.send(message)).status).toBe('retry');
    },
  );

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
