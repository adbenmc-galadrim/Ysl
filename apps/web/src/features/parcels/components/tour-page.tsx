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
import { useTour } from '#/features/parcels/api/use-tour';
import { gapLine, pendingParcelIds } from '#/features/parcels/deposit';
import { formatTime } from '#/features/parcels/model';
import { moveReturns } from '#/features/parcels/returns';
import { putOnTour } from '#/features/parcels/tour';
import { departmentName, parcelsLabel } from '#/features/parcels/tour-view';
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
      const pending = pendingParcelIds(data?.deposits ?? [], departmentId);
      const waits = parcels.every(({ id }) => pending.has(id));
      const count = parcelsLabel(parcels.length, t);
      return {
        id: departmentId,
        name: departmentName(department, t),
        place: department?.receptionPoint ?? '',
        parcels: waits ? t('tour.stop.waiting', { parcels: count }) : count,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const done: TourDoneRow[] = (tour?.done ?? [])
    .map(({ departmentId, count, confirmedAt }) => ({
      id: departmentId,
      name: departmentName(data?.departments.get(departmentId), t),
      line: t('tour.done.line', {
        parcels: parcelsLabel(count, t),
        time: formatTime(confirmedAt),
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const incomplete = data?.incomplete.length ?? 0;
  const toDispatch = data?.toDispatch ?? [];
  const toTake = new Map<string, string[]>();
  for (const { id, departmentId } of data?.returnsToTake ?? []) {
    const key = departmentId ?? '';
    toTake.set(key, [...(toTake.get(key) ?? []), id]);
  }
  const carriedBack = (data?.returnsCarried ?? []).map(({ id }) => id);
  const moveBack = (ids: string[], to: 'retour_en_route' | 'retourne') =>
    void moveReturns(db, ids, to, { agentId: session.user.id });
  const tasks: TourTask[] = [
    ...[...toTake].map(([departmentId, ids]): TourTask => ({
      id: `return-${departmentId}`,
      icon: 'undo',
      title: t('tour.task.returnTake'),
      // The action button sits over the end of the line: a long name would run under it.
      line: `${parcelsLabel(ids.length, t)} · ${departmentName(data?.departments.get(departmentId), t).slice(0, 22)}`,
      action: {
        label: t('tour.task.returnTake.action'),
        onClick: () => moveBack(ids, 'retour_en_route'),
      },
    })),
    ...(carriedBack.length
      ? [
          {
            id: 'return-give',
            icon: 'undo',
            title: parcelsLabel(carriedBack.length, t),
            line: t('tour.task.returnGive'),
            action: {
              label: t('tour.task.returnGive.action'),
              onClick: () => moveBack(carriedBack, 'retourne'),
            },
          } as const,
        ]
      : []),
    ...(incomplete
      ? [
          {
            id: 'incomplete',
            icon: 'alert',
            title: parcelsLabel(incomplete, t),
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
            title: parcelsLabel(toDispatch.length, t),
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
            title: parcelsLabel(unclaimed.parcels, t),
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
        : t('tour.subtitle', {
            served: servedLine ?? '',
            left:
              tour.left === 1
                ? t('tour.left.one')
                : t('tour.left.many', { count: tour.left }),
          });

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
                description: data.lastGap
                  ? gapLine(
                      data.lastGap,
                      departmentName(
                        data.departments.get(data.lastGap.departmentId),
                        t,
                      ),
                      t,
                    )
                  : t('tour.toSettle.description'),
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
                      parcels: parcelsLabel(tour.deposited, t),
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
        onDone={(departmentId) =>
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
