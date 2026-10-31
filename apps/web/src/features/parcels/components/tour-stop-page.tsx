import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  DepositDoneScreen,
  DepositWaitingScreen,
  TourStopScreen,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { loadTour } from '#/features/parcels/api/use-tour';
import {
  gapLine,
  isPending,
  latestFirst,
  pendingParcelIds,
} from '#/features/parcels/deposit';
import {
  carrierLineOf,
  describeParcel,
  formatTime,
} from '#/features/parcels/model';
import { departmentName, parcelsLabel } from '#/features/parcels/tour-view';

const t = createTranslator(DEFAULT_LOCALE);

/** One department of the round: what is left to put down, else where its deposit stands. */
export function TourStopPage({ departmentId }: { departmentId: string }) {
  const navigate = useNavigate();
  const stop = useLiveQuery(async () => {
    const { tour, departments, deposits } = await loadTour(db);
    const carried =
      tour.stops.find((row) => row.departmentId === departmentId)?.parcels ??
      [];
    const pending = pendingParcelIds(deposits);
    const parcels = carried.filter(({ id }) => !pending.has(id));
    const context = await loadRecipientContext(db, parcels);
    const now = new Date();
    const here = latestFirst(
      deposits.filter((row) => row.departmentId === departmentId),
    );
    const next = tour.stops
      .map((row) => ({
        id: row.departmentId,
        count: row.parcels.filter(({ id }) => !pending.has(id)).length,
      }))
      .find((row) => row.id !== departmentId && row.count > 0);
    return {
      tour,
      department: departments.get(departmentId),
      waiting: here.find(isPending),
      last: here.find((row) => row.confirmedAt),
      next: next && {
        ...next,
        name: departmentName(departments.get(next.id), t),
      },
      rows: parcels.map((parcel) => ({
        id: parcel.id,
        title: describeParcel(parcel, 'onTour', context, now, t).recipient,
        line: carrierLineOf(parcel, t),
      })),
    };
  }, [departmentId]);
  if (!stop) return null;
  const home = () => void navigate({ to: '/' });
  const name = departmentName(stop.department, t);
  const { tour, waiting, last, next, rows } = stop;

  if (!rows.length && waiting) {
    const parcels = parcelsLabel(waiting.announced, t);
    return (
      <DepositWaitingScreen
        title={t('deposit.waiting.title', { department: name })}
        text={t('deposit.waiting.text', { parcels })}
        posted={{
          title: t('deposit.waiting.posted', {
            time: formatTime(waiting.postedAt),
          }),
          value: parcels,
        }}
        status={{
          title: t('deposit.waiting.status'),
          value: t('deposit.waiting.pending'),
        }}
        note={t('deposit.waiting.note')}
        actionLabel={t('deposit.waiting.action')}
        onAction={home}
        onClose={home}
      />
    );
  }

  if (!rows.length && last?.confirmedAt) {
    const deposited = last.announced - (last.gapParcelIds?.length ?? 0);
    const time = formatTime(last.confirmedAt);
    return (
      <DepositDoneScreen
        title={
          deposited === 1
            ? t('deposit.done.title.one', { department: name })
            : t('deposit.done.title', { count: deposited, department: name })
        }
        line={
          last.confirmedByName
            ? t('deposit.done.line', { name: last.confirmedByName, time })
            : t('deposit.done.lineNoName', { time })
        }
        gap={
          last.gap
            ? {
                title: t('deposit.done.gap'),
                description: gapLine(last, name, t),
              }
            : undefined
        }
        rows={[
          {
            icon: 'route',
            title: t('deposit.done.tour'),
            value: t('deposit.done.tour.value', {
              served: tour.served,
              total: tour.departments,
            }),
          },
        ]}
        progress={
          tour.departments
            ? {
                value: tour.served / tour.departments,
                label: t('deposit.done.tour'),
              }
            : undefined
        }
        actionLabel={
          next
            ? t('deposit.done.next', {
                department: next.name,
                parcels: parcelsLabel(next.count, t),
              })
            : t('deposit.done.back')
        }
        actionIcon={Boolean(next)}
        onAction={
          next
            ? () =>
                void navigate({
                  to: '/tournee/$departmentId',
                  params: { departmentId: next.id },
                })
            : home
        }
      />
    );
  }

  const count = parcelsLabel(rows.length, t);
  const place = stop.department?.receptionPoint;
  return (
    <TourStopScreen
      name={name}
      subtitle={
        place ? t('tour.stop.subtitle', { place, parcels: count }) : count
      }
      parcels={rows}
      action={
        rows.length ? (
          <Button
            icon="qr"
            iconSize={20}
            className="gap-2"
            onClick={() =>
              void navigate({
                to: '/tournee/$departmentId/depot',
                params: { departmentId },
              })
            }
          >
            {t('deposit.action', { department: name })}
          </Button>
        ) : undefined
      }
      onBack={home}
      onParcel={(parcelId) =>
        void navigate({ to: '/colis/$parcelId', params: { parcelId } })
      }
    />
  );
}
