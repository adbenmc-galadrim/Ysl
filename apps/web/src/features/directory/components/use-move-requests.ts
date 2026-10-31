import type { MoveRequest, RequestMoveInput } from '@repo/contract/directory';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useOnline } from '#/lib/use-online';
import { trpcClient } from '#/lib/trpc';

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
  return { online, requests: data, byPerson, ask, close };
}
