import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type DeskStat,
  RoleHomeDesktop,
  RoleHomeMobile,
  type RoleHomeProps,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import { hasDesk } from '#/features/auth/route-access';
import { db } from '#/features/db/database';
import { useGoesOnTour } from '#/features/parcels/api/use-tour';
import { ColisPage } from '#/features/parcels/components/colis-page';
import { TourPage } from '#/features/parcels/components/tour-page';
import { isPending } from '#/features/parcels/deposit';
import { goesOnTour } from '#/features/parcels/tour';
import { CompaniesPage } from '#/features/platform/components/companies-page';
import { homeCounts, type HomeCounts } from '#/features/shell/home-counts';
import { useOwnDepartmentName } from '#/features/shell/components/use-desk-shell';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

/** The parcels of this device by where they stand; a department pulls only its own. */
function useCounts(): HomeCounts | undefined {
  return useLiveQuery(
    async () =>
      homeCounts(
        await db.parcel.filter((row) => !row.deletedAt).toArray(),
        await goesOnTour(db),
      ),
    [],
  );
}

const shown = (count: number | undefined) =>
  count === undefined ? '…' : String(count);

/** Only when there is one. Orange asks for action: the admin's alone, who reassigns (§2.1). */
const toSettleStat = (
  counts: HomeCounts | undefined,
  tone?: DeskStat['tone'],
): DeskStat[] =>
  counts?.toSettle
    ? [
        {
          label: t('parcel.state.a_regulariser'),
          value: String(counts.toSettle),
          tone,
        },
      ]
    : [];

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

/** Until YSL-82: the parcels really here, and what is still to come. */
export function DepartmentHome() {
  const counts = useCounts();
  const name = useOwnDepartmentName();
  const desk = useMediaQuery(DESK_WIDTH);
  const parcels = useParcelsAction(desk);
  const navigate = useNavigate();
  const toCount = useLiveQuery(
    () => db.deposit.filter(isPending).count(),
    [],
  );
  const action = toCount
    ? {
        label:
          toCount === 1
            ? t('deposits.home.action.one')
            : t('deposits.home.action', { count: toCount }),
        onPress: () => void navigate({ to: '/departement/depots' }),
      }
    : parcels;
  return (
    <RoleHome
      title={t('home.department.title')}
      subtitle={name}
      stats={[
        { label: t('home.stat.coming'), value: shown(counts?.coming) },
        { label: t('home.stat.present'), value: shown(counts?.present) },
        ...toSettleStat(counts),
      ]}
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
  const counts = useCounts();
  const desk = useMediaQuery(DESK_WIDTH);
  const parcels = useParcelsAction(desk);
  const navigate = useNavigate();
  const action = counts?.toSettle
    ? {
        label: t('settlement.home.action'),
        onPress: () => void navigate({ to: '/tableau-de-bord/regulariser' }),
      }
    : parcels;
  return (
    <RoleHome
      title={t('home.dashboard.title')}
      stats={[
        {
          label: t('home.stat.waiting'),
          value: shown(
            counts && counts.coming + counts.present + counts.toSettle,
          ),
        },
        ...toSettleStat(counts, 'orange'),
      ]}
      notice={{
        title: t('home.dashboard.notice.title'),
        description: t('home.dashboard.notice.description'),
      }}
      action={action}
    />
  );
}

/** With tours, the shuttle opens on its round; acting as department, on Colis as ever. */
function ShuttleHome() {
  const tour = useGoesOnTour();
  if (tour === undefined) return null;
  return tour ? <TourPage /> : <ColisPage />;
}

/** `/`, by role: a computer role on a computer opens on its space, everyone else on the work. */
export function HomePage() {
  const session = useSession();
  const role = toUserRole(session.user.role);
  const desk = useMediaQuery(DESK_WIDTH);
  if (role === 'platform_admin') return <CompaniesPage />;
  if (desk && hasDesk(role)) {
    return role === 'department' ? <DepartmentHome /> : <DashboardHome />;
  }
  return role === 'shuttle' ? <ShuttleHome /> : <ColisPage />;
}
