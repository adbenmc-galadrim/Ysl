import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '@repo/auth';
import { newId } from '@repo/shared/id';
import { createTRPCClient, httpLink } from '@trpc/client';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';

const { client, db } = await vi.hoisted(async () => {
  const { openTestDb } = await import('./helpers/pglite');
  return openTestDb();
});

vi.mock('@repo/db', () => ({ db, pingDb: vi.fn() }));
vi.mock('@repo/auth', () => ({ auth: { api: {} }, isAPIError: () => false }));

const { appRouter } = await import('#root');
const { createTRPCContext } = await import('#lib/trpc');
const { HEADERS, sessionFor } = await import('./helpers/caller');
const { AGENT_ID } = await import('./helpers/pglite');

afterAll(async () => {
  await client.close();
});

function memberSession(): Session {
  const session = sessionFor('shuttle');
  return {
    session: { ...session.session, userId: AGENT_ID },
    user: { ...session.user, id: AGENT_ID },
  };
}

/** The web client as apps/web builds it, over the fetch adapter instead of Hono. */
const api = createTRPCClient<typeof appRouter>({
  links: [
    httpLink({
      url: 'http://test/trpc',
      transformer: superjson,
      fetch: (url: string | URL, init?: RequestInit) =>
        fetchRequestHandler({
          endpoint: '/trpc',
          req: new Request(url, init),
          router: appRouter,
          createContext: () =>
            createTRPCContext({ headers: HEADERS, session: memberSession() }),
        }),
    }),
  ],
});

describe('sync over the wire', () => {
  it('carries dates both ways through superjson', async () => {
    const id = newId();
    const receivedAt = new Date('2026-10-24T08:00:00Z');
    const clientTs = new Date('2026-10-24T08:01:00Z');

    const pushed = await api.sync.push.mutate({
      ops: [
        {
          opId: newId(),
          entity: 'parcel',
          entityId: id,
          type: 'upsert',
          clientTs,
          patch: {
            id,
            createdAt: clientTs,
            updatedAt: clientTs,
            deletedAt: null,
            status: 'recu',
            receivedAt,
            receivedBy: AGENT_ID,
          },
        },
      ],
    });
    const pulled = await api.sync.pull.query({ cursor: null });
    const row = pulled.rows.find((change) => change.row.id === id)?.row;

    expect(pushed.results[0]?.status).toBe(200);
    expect(row?.receivedAt).toBeInstanceOf(Date);
    expect(row?.receivedAt).toEqual(receivedAt);
    expect(row?.updatedAt).toEqual(clientTs);
  });
});
