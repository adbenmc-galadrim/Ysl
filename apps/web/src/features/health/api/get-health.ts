import { useQuery } from '@tanstack/react-query';
import { trpc } from '#/lib/trpc';

export function useHealthQuery() {
  return useQuery({
    ...trpc.health.check.queryOptions(),
    refetchInterval: 10_000,
  });
}
