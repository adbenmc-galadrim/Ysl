import { HANDOVER_METHODS, type HandoverMethod } from '@repo/contract/handover';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  DepartementColisDesktop,
  type DepartementFilter,
  type DepartementParcelRow,
  HistoriqueDesktop,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { loadSpace } from '#/features/department-space/load';
import {
  ARRIVALS,
  type Arrival,
  arrivedAt,
  arrivedWithin,
  closedAt,
  depositNotice,
  inTab,
  latestClosedFirst,
  PERIODS,
  type Period,
  provenBy,
  spaceCounts,
  type SpaceParcel,
  SPACE_TABS,
  type SpaceTab,
  takenBy,
  withinPeriod,
} from '#/features/department-space/space';
import { csvFile } from '#/features/exports/csv-file';
import {
  agentNameOf,
  METHOD_ICON,
  methodLabel,
} from '#/features/handover/entry';
import { lastMailLine } from '#/features/mail/tracking';
import { useLatestMail } from '#/features/mail/use-sent-mails';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { formatTracking, formatWhen } from '#/features/parcels/record';
import {
  matchesQuery,
  prepareQuery,
} from '#/features/search/search-index';
import { useOwnDepartment } from '#/features/department-space/use-own-department';
import { useDeskShell } from '#/features/shell/components/use-desk-shell';
import { shareFile } from '#/lib/share-file';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const PAGE = 10;
const TAB_KEY = 'courrier.departement.onglet';

function readTab(): SpaceTab {
  const stored = sessionStorage.getItem(TAB_KEY);
  return SPACE_TABS.find((tab) => tab === stored) ?? 'present';
}

function parcelRow(row: SpaceParcel, now: Date): DepartementParcelRow {
  const { parcel, entry } = row;
  const state =
    row.tab === 'coming'
      ? 'coming'
      : entry.row.state === 'late'
        ? 'late'
        : 'present';
  return {
    id: parcel.id,
    recipient: entry.row.recipient,
    state,
    status: t(`departmentSpace.status.${state}`),
    carrier: entry.row.carrier ?? '',
    tracking: parcel.tracking ? formatTracking(parcel.tracking) : '—',
    arrived: formatWhen(arrivedAt(row), now, t),
  };
}

const HISTORY_TONE = {
  remis: 'green',
  a_regulariser: 'red',
  retourne: 'grey',
} as const;

const choice = <Value extends string>(
  filter: Omit<DepartementFilter, 'value'>,
  selected: Value,
): DepartementFilter => ({
  ...filter,
  value:
    filter.choices.find((option) => option.value === selected)?.label ?? '',
});

/** One page of a list, its range and the pages either side. */
function pageOf<Row>(rows: readonly Row[], page: number) {
  const last = Math.max(0, Math.ceil(rows.length / PAGE) - 1);
  const shown = Math.min(page, last);
  const from = shown * PAGE;
  return {
    rows: rows.slice(from, from + PAGE),
    range: rows.length
      ? t('departmentSpace.range', {
          from: from + 1,
          to: Math.min(from + PAGE, rows.length),
          total: rows.length,
        })
      : t('departmentSpace.range.empty'),
    previous: shown > 0 ? shown - 1 : null,
    next: shown < last ? shown + 1 : null,
  };
}

/** A department on its computer (D23): what comes, what is here, what left. */
export function DepartmentSpaceDesk() {
  const navigate = useNavigate();
  const session = useSession();
  const now = useMinuteClock();
  const online = useOnline();
  const { companyCrumb, ...shell } = useDeskShell();
  const own = useOwnDepartment();
  const parcels = useLiveQuery(() => loadSpace(db, now), [now]);
  const deposits = useLiveQuery(() => db.deposit.toArray(), []);
  const [tab, setTabState] = useState<SpaceTab>(readTab);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('all');
  const [arrival, setArrival] = useState<Arrival>('all');
  const [period, setPeriod] = useState<Period>('last30');
  const [proof, setProof] = useState<HandoverMethod | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string>();
  const mail = useLatestMail(openId ?? '');

  const setTab = (next: string) => {
    const known = SPACE_TABS.find((id) => id === next) ?? 'present';
    sessionStorage.setItem(TAB_KEY, known);
    setTabState(known);
    setPage(0);
    setOpenId(null);
  };

  const all = useMemo(() => parcels ?? [], [parcels]);
  const found = useMemo(() => {
    const prepared = prepareQuery(query);
    return all.filter(({ entry }) => matchesQuery(entry, prepared));
  }, [all, query]);
  const counts = spaceCounts(found);

  const openParcel = (parcelId: string) =>
    void navigate({ to: '/colis/$parcelId', params: { parcelId } });
  const runExport = async () => {
    if (!online) {
      setExportNote(t('export.offline'));
      return;
    }
    try {
      const result = await trpcClient.exports.parcelsCsv.query();
      await shareFile(csvFile(result), t('export.share.title'));
      setExportNote(undefined);
    } catch (error) {
      console.error('Parcels export failed', error);
      setExportNote(t('export.failed'));
    }
  };

  const notice = deposits && depositNotice(deposits, t);
  const pageShell = {
    ...shell,
    searchPlaceholder: t('departmentSpace.search'),
    search: {
      value: query,
      onChange: (value: string) => {
        setQuery(value);
        setPage(0);
      },
    },
    subtitle: own.place ? `${own.name} · ${own.place}` : own.name,
    tabs: SPACE_TABS.map((id) => ({
      id,
      label:
        id === 'history'
          ? t('departmentSpace.tab.history')
          : `${t(`departmentSpace.tab.${id}`)} ${counts[id]}`,
    })),
    activeTab: tab,
    onTab: setTab,
    onExport: () => void runExport(),
    exportNote,
    onHandover: () => void navigate({ to: '/remise' }),
  };

  if (tab === 'history') {
    const rows = latestClosedFirst(inTab(found, 'history')).filter(
      (row) =>
        withinPeriod(closedAt(row), period, now) && provenBy(row, proof),
    );
    const shown = pageOf(rows, page);
    return (
      <HistoriqueDesktop
        {...pageShell}
        breadcrumb={[
          companyCrumb,
          t('directory.nav.parcels'),
          t('departmentSpace.tab.history'),
        ]}
        filters={[
          choice(
            {
              label: t('departmentSpace.filter.period'),
              choices: PERIODS.map((value) => ({
                value,
                label:
                  value === 'all'
                    ? t('departmentSpace.filter.allPeriod')
                    : t('departmentSpace.filter.last30'),
              })),
              selected: period,
              onSelect: (value) => {
                setPeriod(value as Period);
                setPage(0);
              },
              className: 'w-[190px]',
            },
            period,
          ),
          choice(
            {
              label: t('departmentSpace.filter.proof'),
              choices: [
                {
                  value: 'all',
                  label: t('departmentSpace.filter.allProof'),
                },
                ...HANDOVER_METHODS.map((value) => ({
                  value,
                  label: methodLabel(value, t),
                })),
              ],
              selected: proof,
              onSelect: (value) => {
                setProof(value as HandoverMethod | 'all');
                setPage(0);
              },
              className: 'w-[150px]',
            },
            proof,
          ),
        ]}
        rows={shown.rows.map((row) => {
          const { parcel, entry, handover } = row;
          return {
            id: parcel.id,
            recipient: entry.row.recipient,
            tone:
              HISTORY_TONE[parcel.status as keyof typeof HISTORY_TONE] ??
              'grey',
            status: t(`parcel.state.${parcel.status}`),
            to: takenBy(row, t),
            proof: handover && {
              icon: METHOD_ICON[handover.method],
              label: methodLabel(handover.method, t),
            },
            by: handover
              ? agentNameOf(handover, t, session.user.id)
              : '—',
            when: formatWhen(closedAt(row), now, t),
          };
        })}
        range={shown.range}
        onPrevious={
          shown.previous === null
            ? undefined
            : () => setPage(shown.previous ?? 0)
        }
        onNext={
          shown.next === null ? undefined : () => setPage(shown.next ?? 0)
        }
        onRow={openParcel}
        empty={
          rows.length
            ? undefined
            : {
                title: t('departmentSpace.empty.title'),
                description: t('departmentSpace.empty.history'),
              }
        }
      />
    );
  }

  const rows = inTab(found, tab)
    .filter(
      (row) =>
        arrivedWithin(arrivedAt(row), arrival, now) &&
        // Drawn on Présents only: it must not empty another tab unseen.
        (tab !== 'present' ||
          status === 'all' ||
          parcelRow(row, now).state === status),
    )
    .sort((a, b) => arrivedAt(a).getTime() - arrivedAt(b).getTime());
  const shown = pageOf(rows, page);
  const opened = rows.find(({ parcel }) => parcel.id === openId);
  const remindable =
    opened?.entry.row.state === 'late' ||
    opened?.entry.row.state === 'notified';
  return (
    <DepartementColisDesktop
      {...pageShell}
      breadcrumb={[companyCrumb, t('directory.nav.parcels')]}
      deposit={
        notice && {
          title: notice.title,
          description: notice.description,
          action: notice.action,
          onAction: () =>
            void (notice.depositId
              ? navigate({
                  to: '/departement/depots/$depositId',
                  params: { depositId: notice.depositId },
                })
              : navigate({ to: '/departement/depots' })),
        }
      }
      filters={[
        ...(tab === 'present'
          ? [
              choice(
                {
                  label: t('departmentSpace.filter.status'),
                  choices: [
                    {
                      value: 'all',
                      label: t('departmentSpace.filter.allStatus'),
                    },
                    {
                      value: 'present',
                      label: t('departmentSpace.status.present'),
                    },
                    { value: 'late', label: t('departmentSpace.status.late') },
                  ],
                  selected: status,
                  onSelect: (value) => {
                    setStatus(value);
                    setPage(0);
                  },
                  className: 'w-[170px]',
                },
                status,
              ),
            ]
          : []),
        choice(
          {
            label: t('departmentSpace.filter.arrived'),
            choices: ARRIVALS.map((value) => ({
              value,
              label:
                value === 'all'
                  ? t('departmentSpace.filter.allStatus')
                  : t(`departmentSpace.filter.${value}`),
            })),
            selected: arrival,
            onSelect: (value) => {
              setArrival(value as Arrival);
              setPage(0);
            },
            className: 'w-[170px]',
          },
          arrival,
        ),
      ]}
      label={t(`departmentSpace.tab.${tab}`)}
      parcels={shown.rows.map((row) => parcelRow(row, now))}
      range={shown.range}
      onPrevious={
        shown.previous === null
          ? undefined
          : () => setPage(shown.previous ?? 0)
      }
      onNext={
        shown.next === null ? undefined : () => setPage(shown.next ?? 0)
      }
      empty={
        rows.length
          ? undefined
          : {
              title: t('departmentSpace.empty.title'),
              description: t('departmentSpace.empty.description'),
            }
      }
      activeParcel={opened?.parcel.id}
      onParcel={setOpenId}
      panel={
        opened && {
          recipient: opened.entry.row.recipient,
          place: own.name,
          details: [
            {
              label: t('departmentSpace.panel.tracking'),
              value: opened.parcel.tracking
                ? formatTracking(opened.parcel.tracking)
                : '—',
            },
            {
              label: t('departmentSpace.panel.arrived'),
              value: formatWhen(arrivedAt(opened), now, t),
            },
            ...(mail
              ? [
                  {
                    label: t('departmentSpace.panel.email'),
                    value: lastMailLine(mail, now, t),
                  },
                ]
              : []),
          ],
          onClose: () => setOpenId(null),
          onOpen: () => openParcel(opened.parcel.id),
          openLabel: t('departmentSpace.panel.open'),
          remindLabel: t('departmentSpace.panel.remind'),
          onRemind: remindable
            ? () => void navigate({ to: '/relances' })
            : undefined,
        }
      }
    />
  );
}
