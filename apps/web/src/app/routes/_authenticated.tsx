import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { sessionQueryOptions } from '#/features/auth/api/session';
import { requireSession } from '#/features/auth/guards';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { startOfflinePrep } from '#/features/offline/prep';
import { isPrepared } from '#/features/offline/prepared';
import { startSync } from '#/features/sync/sync';

const PREP_PATH = '/preparation';

/**
 * The session ended while the app was open (a 401 of the synchronisation
 * asks again): the device has emptied itself, so leave for sign-in.
 */
function AuthenticatedLayout() {
  const { data: session, isFetched } = useQuery(sessionQueryOptions);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const ended = isFetched && session === null;

  useEffect(() => {
    if (!ended) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'session',
    });
    void navigate({ to: '/connexion', search: {} });
  }, [ended, navigate, queryClient]);

  return <Outlet />;
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    });
    startSync();
    startOfflinePrep();
    if (!isPrepared(localStorage) && location.pathname !== PREP_PATH) {
      throw redirect({ to: PREP_PATH });
    }
    return { session };
  },
  component: AuthenticatedLayout,
});
