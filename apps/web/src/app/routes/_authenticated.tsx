import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CompteSuspenduScreen } from '@repo/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { toUserRole } from '@repo/contract/auth';
import { sessionQueryOptions } from '#/features/auth/api/session';
import { requireSession } from '#/features/auth/guards';
import {
  areaOf,
  mayReach,
  needsPreparation,
} from '#/features/auth/route-access';
import {
  CompanySuspendedPage,
  useCompanySuspended,
} from '#/features/auth/components/company-suspended-page';
import { db } from '#/features/db/database';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { startOfflinePrep } from '#/features/offline/prep';
import { isPrepared } from '#/features/offline/prepared';
import { RoleFrame } from '#/features/shell/components/role-frame';
import { readKeptProfile } from '#/features/settings/operating-profile';
import { startSync } from '#/features/sync/sync';
import { DESK_WIDTH } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

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
  const suspended = useCompanySuspended();

  useEffect(() => {
    if (!ended) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'session',
    });
    void navigate({ to: '/connexion', search: {} });
  }, [ended, navigate, queryClient]);

  // The session is kept on purpose: its absence would empty the device.
  if (session?.user.banned) {
    return (
      <CompteSuspenduScreen
        title={t('accounts.suspended.title')}
        lines={[t('accounts.suspended.data'), t('accounts.suspended.action')]}
        retryLabel={t('accounts.suspended.retry')}
        onRetry={() => location.reload()}
      />
    );
  }
  if (suspended) return <CompanySuspendedPage />;

  return (
    <RoleFrame>
      <Outlet />
    </RoleFrame>
  );
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    });
    if (session.user.banned) return { session };
    const role = toUserRole(session.user.role);
    const area = areaOf(location.pathname);
    const profile =
      area === 'handover' && role === 'shuttle'
        ? await readKeptProfile(db)
        : null;
    if (area && !mayReach(area, role, profile)) {
      throw redirect({ to: '/' });
    }
    // The app's admin has nothing to pull and no label to read (D26).
    if (role !== 'platform_admin') startSync();
    if (needsPreparation(role, matchMedia(DESK_WIDTH).matches)) {
      startOfflinePrep();
      if (!isPrepared(localStorage) && location.pathname !== PREP_PATH) {
        throw redirect({ to: PREP_PATH });
      }
    }
    return { session };
  },
  component: AuthenticatedLayout,
});
