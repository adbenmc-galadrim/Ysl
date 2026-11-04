import { describe, expect, it } from 'vitest';
import { checkGoLive, formatChecks, hasFailure } from '#ops/go-live';
import type { Check } from '#ops/go-live';

const API = 'https://api.example.com';
const WEB = 'https://app.example.com';
const KEY = 'brevo-key-never-printed';
const ALL_EVENTS = [
  'delivered',
  'hardBounce',
  'invalid',
  'blocked',
  'spam',
  'unsubscribed',
];

type Routes = Record<string, () => Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function healthy(overrides: Routes = {}): Routes {
  return {
    [`GET ${API}/health`]: () => new Response('ok'),
    [`GET ${API}/ready`]: () => json({ status: 'ready' }),
    [`GET ${WEB}/version.json`]: () =>
      json({ builtAt: '2026-11-03T10:09:50.614Z' }),
    [`POST ${API}/api/webhooks/mail`]: () =>
      new Response(null, { status: 401 }),
    'GET https://api.brevo.com/v3/account': () => json({}),
    'GET https://api.brevo.com/v3/webhooks?type=transactional': () =>
      json({
        webhooks: [
          { id: 7, url: `${API}/api/webhooks/mail`, events: ALL_EVENTS },
        ],
      }),
    'GET https://api.brevo.com/v3/senders/domains': () =>
      json({ domains: [{ domain_name: 'example.org', authenticated: true }] }),
    ...overrides,
  };
}

function fakeFetch(routes: Routes): typeof fetch {
  return (input, init) => {
    const route =
      routes[
        `${init?.method ?? 'GET'} ${input instanceof Request ? input.url : input.toString()}`
      ];
    return Promise.resolve(
      route ? route() : new Response(null, { status: 599 }),
    );
  };
}

function byName(checks: Check[], name: string): Check | undefined {
  return checks.find((check) => check.name === name);
}

describe('checkGoLive', () => {
  it('reads a 404 on the webhook route as server mail off, a 401 as on', async () => {
    const off = await checkGoLive(
      { apiUrl: API, webUrl: WEB },
      fakeFetch(
        healthy({
          [`POST ${API}/api/webhooks/mail`]: () =>
            new Response(null, { status: 404 }),
        }),
      ),
    );
    const on = await checkGoLive(
      { apiUrl: `${API}/`, webUrl: WEB },
      fakeFetch(healthy()),
    );

    expect(byName(off, 'Envoi par le serveur')?.status).toBe('warn');
    expect(byName(off, 'Envoi par le serveur')?.detail).toContain(
      'messagerie du téléphone',
    );
    expect(byName(on, 'Envoi par le serveur')?.status).toBe('ok');
  });

  it('fails when the API answers health but its database does not', async () => {
    const checks = await checkGoLive(
      { apiUrl: API, webUrl: WEB },
      fakeFetch(
        healthy({
          [`GET ${API}/ready`]: () => new Response(null, { status: 503 }),
        }),
      ),
    );

    expect(byName(checks, 'API')?.status).toBe('ok');
    expect(byName(checks, 'Base de données')?.status).toBe('fail');
    expect(hasFailure(checks)).toBe(true);
  });

  it('flags a Brevo webhook pointed elsewhere or missing an event', async () => {
    const elsewhere = await checkGoLive(
      { apiUrl: API, webUrl: WEB, brevoApiKey: KEY },
      fakeFetch(
        healthy({
          'GET https://api.brevo.com/v3/webhooks?type=transactional': () =>
            json({
              webhooks: [
                {
                  id: 1,
                  url: 'https://old.example.com/api/webhooks/mail',
                  events: ALL_EVENTS,
                },
              ],
            }),
        }),
      ),
    );
    const partial = await checkGoLive(
      { apiUrl: API, webUrl: WEB, brevoApiKey: KEY },
      fakeFetch(
        healthy({
          'GET https://api.brevo.com/v3/webhooks?type=transactional': () =>
            json({
              webhooks: [
                {
                  id: 2,
                  url: `${API}/api/webhooks/mail`,
                  events: ['delivered'],
                },
              ],
            }),
        }),
      ),
    );

    expect(byName(elsewhere, 'Webhook Brevo')?.status).toBe('fail');
    expect(byName(partial, 'Webhook Brevo')?.detail).toContain('hardBounce');
    expect(hasFailure(partial)).toBe(true);
  });

  it('tells a pilot domain declared but not verified from one not declared', async () => {
    const routes = healthy({
      'GET https://api.brevo.com/v3/senders/domains': () =>
        json({
          domains: [{ domain_name: 'pilot.example.org', authenticated: false }],
        }),
    });
    const declared = await checkGoLive(
      {
        apiUrl: API,
        webUrl: WEB,
        brevoApiKey: KEY,
        senderDomain: 'Pilot.example.org',
      },
      fakeFetch(routes),
    );
    const absent = await checkGoLive(
      {
        apiUrl: API,
        webUrl: WEB,
        brevoApiKey: KEY,
        senderDomain: 'other.example.org',
      },
      fakeFetch(routes),
    );

    expect(byName(declared, 'Domaine pilote')?.status).toBe('fail');
    expect(byName(absent, 'Domaine pilote')?.status).toBe('warn');
  });

  it('passes on a healthy deployment and never prints the key', async () => {
    const checks = await checkGoLive(
      { apiUrl: API, webUrl: WEB, brevoApiKey: KEY },
      fakeFetch(healthy()),
    );

    expect(hasFailure(checks)).toBe(false);
    expect(formatChecks(checks)).not.toContain(KEY);
  });
});
