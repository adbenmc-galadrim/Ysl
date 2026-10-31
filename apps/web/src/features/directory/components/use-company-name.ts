import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '#/lib/trpc';

/** The name in the desktop sidebar, empty until it is known. */
export function useCompanyName(): string {
  const { data } = useQuery({
    queryKey: ['account', 'company'],
    queryFn: () => trpcClient.account.company.query(),
    staleTime: 3_600_000,
  });
  return data?.name ?? '';
}
