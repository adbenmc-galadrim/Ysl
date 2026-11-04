import { describe, expect, it, vi } from 'vitest';
import { describeMailWebhook, ensureMailWebhook } from '#ops/brevo-webhook';

const API = 'https://api.example.com';
const URL_ = `${API}/api/webhooks/mail`;
const KEY = 'brevo-key-never-printed';
const TOKEN = 't'.repeat(32);
const ALL_EVENTS = [
  'delivered',
  'hardBounce',
  'invalid',
  'blocked',
  'spam',
  'unsubscribed',
];

function brevo(webhooks: unknown[]) {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(
      init?.method === 'POST'
        ? new Response(JSON.stringify({ id: 42 }), { status: 201 })
        : new Response(JSON.stringify({ webhooks })),
    ),
  );
}

describe('ensureMailWebhook', () => {
  it('creates nothing when the webhook is already there', async () => {
    const fetchImpl = brevo([{ id: 7, url: `${URL_}/`, events: ALL_EVENTS }]);

    const result = await ensureMailWebhook(
      { apiUrl: `${API}/`, brevoApiKey: KEY, token: TOKEN },
      fetchImpl,
    );

    expect(result).toEqual({ action: 'exists', id: 7, url: URL_ });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('creates it with a bearer token and every event the API reads', async () => {
    const fetchImpl = brevo([
      {
        id: 1,
        url: 'https://old.example.com/api/webhooks/mail',
        events: ALL_EVENTS,
      },
    ]);

    const result = await ensureMailWebhook(
      { apiUrl: API, brevoApiKey: KEY, token: TOKEN },
      fetchImpl,
    );

    expect(result).toEqual({ action: 'created', id: 42, url: URL_ });
    const [url, init] = fetchImpl.mock.calls[1] ?? [];
    expect(url).toBe('https://api.brevo.com/v3/webhooks');
    expect(new Headers(init?.headers).get('api-key')).toBe(KEY);
    expect(JSON.parse(init?.body as string)).toEqual({
      type: 'transactional',
      url: URL_,
      description: 'Courrier : statuts des e-mails',
      events: ALL_EVENTS,
      auth: { type: 'bearer', token: TOKEN },
    });
  });

  it('reports a webhook missing events instead of adding a second one', async () => {
    const fetchImpl = brevo([
      { id: 7, url: URL_, events: ['delivered', 'spam'] },
    ]);

    const result = await ensureMailWebhook(
      { apiUrl: API, brevoApiKey: KEY, token: TOKEN },
      fetchImpl,
    );

    expect(result).toMatchObject({
      action: 'incomplete',
      missing: ['hardBounce', 'invalid', 'blocked', 'unsubscribed'],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sees a complete webhook among several on the same URL, whatever the case', async () => {
    const fetchImpl = brevo([
      { id: 3, url: URL_ },
      {
        id: 7,
        url: URL_.replace('api.example', 'API.Example'),
        events: ALL_EVENTS,
      },
    ]);

    const result = await ensureMailWebhook(
      { apiUrl: API, brevoApiKey: KEY, token: TOKEN },
      fetchImpl,
    );

    expect(result).toEqual({ action: 'exists', id: 7, url: URL_ });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('only says what it would do on a dry run', async () => {
    const fetchImpl = brevo([]);

    const result = await ensureMailWebhook(
      { apiUrl: API, brevoApiKey: KEY, token: TOKEN, dryRun: true },
      fetchImpl,
    );

    expect(result.action).toBe('would-create');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses a token the API would refuse, before calling Brevo', async () => {
    const fetchImpl = brevo([]);

    await expect(
      ensureMailWebhook(
        { apiUrl: API, brevoApiKey: KEY, token: 'short' },
        fetchImpl,
      ),
    ).rejects.toThrow('32 caractères');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never prints the key nor the token', async () => {
    const result = await ensureMailWebhook(
      { apiUrl: API, brevoApiKey: KEY, token: TOKEN },
      brevo([]),
    );

    const text = describeMailWebhook(result);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(TOKEN);
  });
});
