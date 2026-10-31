import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  PlatformHomeScreen,
  RoleHomeDesktop,
  RoleHomeMobile,
  type RoleHomeProps,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSignOut } from '#/features/auth/api/sign-out';
import { useSession } from '#/features/auth/api/use-session';
import { hasDesk } from '#/features/auth/route-access';
import { db } from '#/features/db/database';
import { ColisPage } from '#/features/parcels/components/colis-page';
import { signOutMessage } from '#/features/settings/components/account-screen';
import { useOwnDepartmentName } from '#/features/shell/components/use-desk-shell';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const WAITING = new Set(['a_completer', 'recu', 'notifie']);

/** The parcels of this device that wait for someone; a department pulls only its own. */
function useWaitingCount(): string {
  const count = useLiveQuery(
    () =>
      db.parcel
        .filter((row) => !row.deletedAt && WAITING.has(row.status))
        .count(),
    [],
  );
  return count === undefined ? '…' : String(count);
}

function RoleHome(props: RoleHomeProps) {
  const navigate = useNavigate();
  const desk = useMediaQuery(DESK_WIDTH);
  return desk ? (
    <RoleHomeDesktop {...props} />
  ) : (
    <RoleHomeMobile
      {...props}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}

function useParcelsAction(desk: boolean): RoleHomeProps['action'] {
  const navigate = useNavigate();
  return {
    label: t('home.action.parcels'),
    onPress: () => void navigate({ to: desk ? '/colis' : '/' }),
  };
}

/** Until YSL-133: the shuttle's work stays on Colis. */
export function TourHome() {
  const action = useParcelsAction(false);
  const navigate = useNavigate();
  return (
    <RoleHomeMobile
      title={t('home.tour.title')}
      notice={{
        title: t('home.tour.notice.title'),
        description: t('home.tour.notice.description'),
      }}
      action={action}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}

/** Until YSL-82 and YSL-136: the parcels really here, and what is still to come. */
export function DepartmentHome() {
  const present = useWaitingCount();
  const name = useOwnDepartmentName();
  const desk = useMediaQuery(DESK_WIDTH);
  const action = useParcelsAction(desk);
  return (
    <RoleHome
      title={t('home.department.title')}
      subtitle={name}
      stats={[{ label: t('home.stat.present'), value: present }]}
      notice={{
        title: t('home.department.notice.title'),
        description: t('home.department.notice.description'),
      }}
      action={action}
    />
  );
}

/** Until YSL-137: what is waiting in the whole company, and nothing made up. */
export function DashboardHome() {
  const waiting = useWaitingCount();
  const desk = useMediaQuery(DESK_WIDTH);
  const action = useParcelsAction(desk);
  return (
    <RoleHome
      title={t('home.dashboard.title')}
      stats={[{ label: t('home.stat.waiting'), value: waiting }]}
      notice={{
        title: t('home.dashboard.notice.title'),
        description: t('home.dashboard.notice.description'),
      }}
      action={action}
    />
  );
}

/** Until YSL-121: the app's admin has no screen of its own, only this one. */
function PlatformHome() {
  const session = useSession();
  const signOut = useSignOut();
  return (
    <PlatformHomeScreen
      title={t('home.platform.title')}
      description={t('home.platform.description')}
      name={session.user.name}
      email={session.user.email}
      signOutLabel={t('auth.signOut')}
      signingOut={signOut.isPending}
      onSignOut={() => signOut.mutate({})}
      error={signOut.isError ? signOutMessage(signOut.error) : undefined}
    />
  );
}

/** `/`, by role: a computer role on a computer opens on its space, everyone else on the work. */
export function HomePage() {
  const session = useSession();
  const role = toUserRole(session.user.role);
  const desk = useMediaQuery(DESK_WIDTH);
  if (role === 'platform_admin') return <PlatformHome />;
  if (desk && hasDesk(role)) {
    return role === 'department' ? <DepartmentHome /> : <DashboardHome />;
  }
  return <ColisPage />;
}
