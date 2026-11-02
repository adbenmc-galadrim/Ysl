import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  type OverviewLine,
  type OverviewProps,
  VueDEnsembleDesktop,
  VueDEnsembleMobile,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import {
  clockTime,
  type DashboardFigures,
  type DashboardLine,
  formatDelay,
  loadDashboard,
  NO_DEPARTMENT,
} from '#/features/dashboard/figures';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { shortDate } from '#/features/parcels/model';
import { syncNow } from '#/features/sync/sync';
import { awaitsServer } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const MOST_SHOWN = 3;

const figure = (count: number) => (count ? String(count) : '—');

const longDay = (date: Date) =>
  date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Figures kept from another day say which: « 9:12 » alone would read as this morning. */
const when = (date: Date, now: Date) =>
  sameDay(date, now)
    ? clockTime(date)
    : `${shortDate(date, now)}, ${clockTime(date)}`;

function toLine(line: DashboardLine, now: Date): OverviewLine {
  const since = line.depositSince;
  return {
    id: line.departmentId ?? NO_DEPARTMENT,
    name: line.name ?? t('dashboard.noDepartment'),
    coming: figure(line.coming),
    waiting: figure(line.waiting),
    late: figure(line.late),
    blocked: figure(line.toSettle),
    ...(since && {
      deposit: t('dashboard.depositSince', {
        when: sameDay(since, now) ? clockTime(since) : shortDate(since, now),
      }),
    }),
    delay: formatDelay(line.delayDays, t),
  };
}

/** `/tableau-de-bord`: what waits and what blocks, department by department (ME32). */
export function DashboardHome() {
  const navigate = useNavigate();
  const desk = useMediaQuery(DESK_WIDTH);
  const sync = useSync();
  const now = useMinuteClock();
  const figures: DashboardFigures | undefined = useLiveQuery(
    () => loadDashboard(db, now, t),
    [now],
  );
  // What the server may still send: no figure before it spoke, rather than a false zero.
  const known = figures && !awaitsServer(sync) ? figures : undefined;
  const value = (count: number | undefined) =>
    count === undefined ? '…' : String(count);
  const updated = sync.lastSyncAt;
  const stale = !sync.online || sync.status === 'error';

  const props: OverviewProps = {
    subtitle: desk
      ? [
          t('dashboard.today', { day: longDay(now) }),
          ...(updated
            ? [t('dashboard.updated', { time: when(updated, now) })]
            : []),
        ].join(' · ')
      : !updated || sameDay(updated, now)
        ? t('dashboard.todayShort', { time: clockTime(updated ?? now) })
        : when(updated, now),
    stats: {
      coming: value(known?.totals.coming),
      waiting: value(known?.totals.waiting),
      late: value(known?.totals.late),
      blocked: value(known?.totals.toSettle),
      handedToday: value(known?.totals.handedToday),
    },
    blockedCount: known?.totals.toSettle ?? 0,
    // The computer has « Tout voir »; the phone has only this list.
    toResolve: (known?.toSettle ?? [])
      .slice(0, desk ? MOST_SHOWN : undefined)
      .map((row) => ({
        id: row.id,
        name: row.name,
        department: row.department ?? t('settlement.none'),
        reason: row.cause,
        since: row.since,
      })),
    lines: (known?.lines ?? []).map((line) => toLine(line, now)),
    ...(stale && {
      stale: {
        title: t('dashboard.stale.title'),
        description: updated
          ? t('dashboard.stale.since', { time: when(updated, now) })
          : t('dashboard.stale.description'),
        onRetry: () => void syncNow({ force: true }),
      },
    }),
    onResolve: (colis) =>
      void navigate({ to: '/tableau-de-bord/regulariser', search: { colis } }),
    onResolveAll: () => void navigate({ to: '/tableau-de-bord/regulariser' }),
    onOpenLine: (departement) =>
      void navigate({ to: '/colis', search: { departement } }),
  };

  return desk ? (
    <VueDEnsembleDesktop {...props} />
  ) : (
    <VueDEnsembleMobile
      {...props}
      onMenu={() => void navigate({ to: '/reglages' })}
    />
  );
}
