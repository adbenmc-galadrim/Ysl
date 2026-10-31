import { useQuery, useQueryClient } from '@tanstack/react-query';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const COMPANY_KEY = ['company', 'get'] as const;

/** The company's settings as the server holds them: only it sees every row. */
export function useCompany() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: COMPANY_KEY,
    queryFn: () => trpcClient.company.get.query(),
    enabled: online,
  });
  /** Read again, here and in the sidebar, and on this device's own copy. */
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: COMPANY_KEY });
    await queryClient.invalidateQueries({ queryKey: ['account', 'company'] });
    void syncNow();
  };
  return { query, online, refresh };
}

/** The server's refusals are written for the admin; anything else stays generic. */
export function refusal(error: unknown, generic: string): string {
  const { data, message } = error as {
    data?: { code?: string };
    message?: string;
  };
  return message && data?.code === 'BAD_REQUEST' ? message : generic;
}
