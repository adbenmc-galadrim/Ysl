import type { AppRouter } from '@repo/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { useEffect, useState } from 'react';
import type { LocalDirectoryPerson } from '#/features/db/schema';
import { MOVE_REQUESTS_KEY } from '#/features/directory/components/use-move-requests';
import { syncNow } from '#/features/sync/sync';
import { useOnline } from '#/lib/use-online';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

/**
 * Moving a person: the server alone moves anyone, so it takes the network. It
 * says first what the move changes, then the next pull brings the card and
 * their parcels down.
 */
export function useMove(person: LocalDirectoryPerson | undefined) {
  const online = useOnline();
  const current = person?.departmentId ?? '';
  const [target, setTarget] = useState(current);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const personId = person?.id;

  useEffect(() => {
    setTarget(current);
    setFailed(null);
  }, [current, personId]);

  const choose = (id: string) => {
    setTarget(id);
    setFailed(null);
  };

  const chosen = target !== '' && target !== current;
  const effects = useQuery({
    queryKey: ['directory', 'moveEffects', personId, target],
    enabled: chosen && online && personId !== undefined,
    staleTime: 0,
    gcTime: 0,
    queryFn: () =>
      trpcClient.directory.moveEffects.query({ personId: personId! }),
  });

  const move = async () => {
    if (!personId || !chosen || moving) return false;
    setMoving(true);
    setFailed(null);
    try {
      await trpcClient.directory.move.mutate({
        personId,
        departmentId: target,
      });
      void queryClient.invalidateQueries({ queryKey: MOVE_REQUESTS_KEY });
      // A pass already running may have pulled before the move: one more after it.
      await syncNow({ force: true });
      void syncNow({ force: true });
      return true;
    } catch (error) {
      // The server names the department that already has this address.
      setFailed(
        error instanceof TRPCClientError &&
          (error as TRPCClientError<AppRouter>).data?.code === 'CONFLICT'
          ? error.message
          : t('directory.move.failed'),
      );
      return false;
    } finally {
      setMoving(false);
    }
  };

  const message = !chosen
    ? undefined
    : !online
      ? t('directory.move.offline')
      : (failed ??
        (effects.isError ? t('directory.move.failed') : undefined));

  return {
    target,
    setTarget: choose,
    chosen,
    moving,
    effects: effects.data,
    canMove: chosen && online && effects.isSuccess && !moving,
    message,
    move,
    reset: () => setTarget(current),
  };
}
