import { authClient } from '@repo/auth/client';
import { queryOptions } from '@tanstack/react-query';

export const sessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const { data, error } = await authClient.getSession().catch(() => ({
      data: null,
      error: true,
    }));
    return error ? null : data;
  },
  staleTime: 5 * 60 * 1000,
});
