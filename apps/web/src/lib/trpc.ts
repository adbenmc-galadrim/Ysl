import type { AppRouter } from '@repo/api';
import { env } from '@repo/shared/env/web';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { queryClient } from '#/lib/query-client';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.PUBLIC_SERVER_URL}/trpc`,
      fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
