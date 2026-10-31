import type { MoveRequest, RequestMoveInput } from '@repo/contract/directory';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useOnline } from '#/lib/use-online';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

export const MOVE_REQUESTS_KEY = ['directory', 'moveRequests'];

const NO_REQUESTS: MoveRequest[] = [];

/** The requests still open, as this account reaches them; they take the network. */
export function useMoveRequests() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const { data = NO_REQUESTS } = useQuery({
    queryKey: MOVE_REQUESTS_KEY,
    enabled: online,
    queryFn: () => trpcClient.directory.moveRequests.query(),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: MOVE_REQUESTS_KEY });
  const ask = useMutation({
    mutationFn: (input: RequestMoveInput) =>
      trpcClient.directory.requestMove.mutate(input),
    onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: (personId: string) =>
      trpcClient.directory.closeMoveRequest.mutate({ personId }),
    onSuccess: refresh,
  });
  const byPerson = useMemo(
    () => new Map(data.map((row) => [row.personId, row])),
    [data],
  );
  /** Closed by the admin: the network is needed, and a failure is shown until the next record. */
  const dismiss = (personId: string) => {
    if (online) close.mutate(personId);
  };
  const dismissMessage = !online
    ? t('directory.request.offline')
    : close.isError
      ? t('directory.request.dismissFailed')
      : undefined;
  return {
    online,
    requests: data,
    byPerson,
    ask,
    close,
    dismiss,
    dismissMessage,
  };
}
