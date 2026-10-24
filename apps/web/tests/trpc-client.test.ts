import { afterEach, describe, expect, it, vi } from 'vitest';
import superjson from 'superjson';

vi.mock('@repo/shared/env/web', () => ({
  env: { PUBLIC_SERVER_URL: 'http://api.test' },
}));

const { trpcClient } = await import('#/lib/trpc');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trpcClient', () => {
  it('gets dates back as dates, and sends them so the server can', async () => {
    const receivedAt = new Date('2026-10-24T08:00:00Z');
    const fetchMock = vi.fn((_url: string | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              result: {
                data: superjson.serialize({
                  generation: '01a16d62-0000-7000-8000-000000000000',
                  reset: false,
                  rows: [{ entity: 'parcel', row: { id: 'p1', receivedAt } }],
                  next: null,
                  cursor: 42,
                }),
              },
            },
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
            statusText: init?.method ?? 'GET',
          },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const output = await trpcClient.sync.pull.query({
      cursor: null,
      page: null,
      limit: 10,
    });

    const row = output.rows[0]?.row as { receivedAt: unknown } | undefined;
    expect(row?.receivedAt).toBeInstanceOf(Date);
    expect(row?.receivedAt).toEqual(receivedAt);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('http://api.test/trpc/sync.pull');
    expect(decodeURIComponent(url)).toContain('"json"');
  });
});
