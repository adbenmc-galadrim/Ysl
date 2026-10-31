import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Toast,
  type TourDoneRow,
  TourScreen,
  type TourStopRow,
  type TourTask,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { ReprendreLot } from '#/features/batch/components/reprendre-lot';
import { db } from '#/features/db/database';
import type { LocalDepartment } from '#/features/db/schema';
import { useTour } from '#/features/parcels/api/use-tour';
import { formatTime } from '#/features/parcels/model';
import { putOnTour } from '#/features/parcels/tour';
import { useSync } from '#/features/sync/use-sync';
import {
  pendingBanner,
  showsPendingBanner,
  syncPill,
} from '#/features/sync/sync-value';
import { applyUpdate, useUpdate } from '#/features/update/updater';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const parcelsLabel = (count: number) =>
  count === 1 ? t('tour.parcels.one') : t('tour.parcels.many', { count });

export const departmentName = (department: LocalDepartment | undefined) =>
  department?.name ?? t('tour.department.unknown');

/** Asked of the server: nobody's phone holds these parcels. Offline, the line is simply absent. */
function useUnclaimed() {
  const online = useOnline();
  const [parcels, setParcels] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!online) return;
    let live = true;
    trpcClient.tour.unclaimed
      .query()
      .then((output) => {
        if (live) setParcels(output.parcels);
      })
      .catch(() => {
        if (live) setParcels(0);
      });
    return () => {
      live = false;
    };
  }, [online]);
  const claim = () => {
    setFailed(false);
    void trpcClient.tour.claim
      .mutate()
      .then(() => {
        setParcels(0);
        void syncNow({ force: true });
      })
      .catch(() => setFailed(true));
  };
  return { parcels: online ? parcels : 0, failed, claim };
}

/** Home of a shuttle on tour (§3.7.6): where to go and what to put down. */
export function TourPage() {
  const session = useSession();
  const navigate = useNavigate();
  const data = useTour();
  const sync = useSync();
  const unclaimed = useUnclaimed();
  const update = useUpdate();
  const banner = showsPendingBanner(sync) ? pendingBanner(sync, t) : null;

  const tour = data?.tour;
  const stops: TourStopRow[] = (tour?.stops ?? [])
    .map(({ departmentId, parcels }) => {
      const department = data?.departments.get(departmentId);
      return {
        id: departmentId,
        name: departmentName(department),
        place: department?.receptionPoint ?? '',
        parcels: parcelsLabel(parcels.length),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const done: TourDoneRow[] = (tour?.done ?? [])
    .map(({ departmentId, count, confirmedAt }) => ({
      id: departmentId,
      name: departmentName(data?.departments.get(departmentId)),
      line: t('tour.done.line', {
        parcels: parcelsLabel(count),
        time: formatTime(confirmedAt),
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const incomplete = data?.incomplete.length ?? 0;
  const toDispatch = data?.toDispatch ?? [];
  const tasks: TourTask[] = [
    ...(incomplete
      ? [
          {
            id: 'incomplete',
            icon: 'alert',
            title: parcelsLabel(incomplete),
            line: t('tour.task.incomplete'),
            onClick: () => void navigate({ to: '/colis' }),
          } as const,
        ]
      : []),
    ...(toDispatch.length
      ? [
          {
            id: 'dispatch',
            icon: 'package',
            title: parcelsLabel(toDispatch.length),
            line: t('tour.task.dispatch'),
            action: {
              label: t('tour.task.dispatch.action'),
              onClick: () =>
                void putOnTour(
                  db,
                  toDispatch.map(({ id }) => id),
                  { agentId: session.user.id },
                ),
            },
          } as const,
        ]
      : []),
    ...(unclaimed.parcels
      ? [
          {
            id: 'unclaimed',
            icon: 'users',
            title: parcelsLabel(unclaimed.parcels),
            line: unclaimed.failed
              ? t('tour.task.unclaimed.failed')
              : t('tour.task.unclaimed'),
            action: {
              label: t('tour.task.unclaimed.action'),
              onClick: unclaimed.claim,
            },
          } as const,
        ]
      : []),
  ];

  const hasTour = Boolean(tour && (tour.departments > 0 || tour.closed));
  const servedLine =
    tour &&
    (tour.served === 1
      ? t('tour.progress.one', { total: tour.departments })
      : t('tour.progress.many', {
          count: tour.served,
          total: tour.departments,
        }));
  const subtitle =
    !tour || !hasTour
      ? undefined
      : tour.closed
        ? servedLine
        : `${servedLine} · ${
            tour.left === 1
              ? t('tour.left.one')
              : t('tour.left.many', { count: tour.left })
          }`;

  return (
    <>
      <TourScreen
        sync={syncPill(sync)}
        subtitle={subtitle}
        progress={tour && hasTour ? tour.served / tour.departments : undefined}
        alert={
          data?.toSettle
            ? {
                title:
                  data.toSettle === 1
                    ? t('tour.toSettle.one')
                    : t('tour.toSettle.many', { count: data.toSettle }),
                description: t('tour.toSettle.description'),
              }
            : undefined
        }
        tasks={tasks}
        stops={stops}
        done={done}
        hero={
          !data
            ? undefined
            : tour?.closed
              ? {
                  icon: 'check',
                  title: t('tour.closed.title'),
                  text: t(
                    tour.departments === 1
                      ? 'tour.closed.text.one'
                      : 'tour.closed.text',
                    {
                      parcels: parcelsLabel(tour.deposited),
                      deposits: tour.departments,
                    },
                  ),
                }
              : hasTour || tasks.length
                ? undefined
                : {
                    icon: 'scan',
                    title: t('tour.empty.title'),
                    text: t('tour.empty.text'),
                  }
        }
        allParcels={{
          label: t('tour.allParcels'),
          onClick: () => void navigate({ to: '/colis' }),
        }}
        notice={
          banner && (
            <Banner
              tone={banner.tone}
              icon={banner.icon}
              title={banner.title}
              description={banner.description}
              onClick={() => void navigate({ to: '/reglages/synchronisation' })}
              classNames={{
                root: banner.tone === 'orange' ? 'h-16 py-[11px]' : undefined,
                description: 'mt-[3px] leading-4',
              }}
            />
          )
        }
        toast={
          update.offered ? (
            <Toast
              message={t('update.available')}
              actionLabel={t('update.apply')}
              onAction={() => void applyUpdate()}
            />
          ) : undefined
        }
        onStop={(departmentId) =>
          void navigate({
            to: '/tournee/$departmentId',
            params: { departmentId },
          })
        }
        onMenu={() => void navigate({ to: '/reglages' })}
        onSearch={() => void navigate({ to: '/recherche' })}
        onScan={() => void navigate({ to: '/scan' })}
      />
      <ReprendreLot />
    </>
  );
}
