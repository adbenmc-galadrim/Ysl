import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  RapportsDepartementMobile,
  RapportsDesktop,
  RapportsMobile,
  RapportsPrint,
  RapportsVideMobile,
  type ReportFigures as ReportFiguresView,
  type ReportLine as ReportLineView,
} from '@repo/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import {
  clockTime,
  formatDelay,
  syncedWhen,
} from '#/features/dashboard/figures';
import { db } from '#/features/db/database';
import { csvFile } from '#/features/exports/csv-file';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import {
  carrierVolumes,
  loadReport,
  periodRange,
  REPORT_PERIODS,
  type Report,
  type ReportFigures,
  type ReportLine,
  type ReportPeriod,
} from '#/features/reports/figures';
import { syncNow } from '#/features/sync/sync';
import { awaitsServer } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';
import { printAlone } from '#/lib/print-alone';
import { shareFile } from '#/lib/share-file';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const ALL = 'all';

/** A4 sideways: the page's 1152 px, brought down to the sheet. */
const PRINT_CSS =
  '@page{size:A4 landscape;margin:10mm}html,body{margin:0;background:#fff}body{zoom:.85}';

const whole = (count: number) => count.toLocaleString('fr-FR');

const PERIOD_LABEL = {
  week: t('reports.period.week'),
  month: t('reports.period.month'),
  quarter: t('reports.period.quarter'),
} as const satisfies Record<ReportPeriod, string>;

const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);

function periodLabel(period: ReportPeriod, now: Date): string {
  const { from } = periodRange(period, now);
  if (period === 'week') {
    return t('reports.weekOf', {
      day: from.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    });
  }
  if (period === 'quarter') {
    const quarter = from.getMonth() / 3 + 1;
    const year = from.getFullYear();
    return quarter === 1
      ? t('reports.quarterFirst', { year })
      : t('reports.quarterOf', { quarter, year });
  }
  return capitalized(
    from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  );
}

const nameOf = (line: Pick<ReportLine, 'name'>) =>
  line.name ?? t('dashboard.noDepartment');

function toFigures(figures: ReportFigures): ReportFiguresView {
  return {
    received: whole(figures.received),
    handed: whole(figures.handed),
    delay: formatDelay(figures.delayDays, t),
    late: whole(figures.late),
    gaps: whole(figures.gaps),
  };
}

const toLine = (line: ReportLine): ReportLineView => ({
  id: line.id,
  name: nameOf(line),
  received: whole(line.received),
  handed: whole(line.handed),
  delay: formatDelay(line.delayDays, t),
  reminders: whole(line.reminders),
  gaps: whole(line.gaps),
  proof: line.proof ? t(`reports.proof.${line.proof}`) : '—',
});

const UNKNOWN: ReportFiguresView = {
  received: '…',
  handed: '…',
  delay: '…',
  late: '…',
  gaps: '…',
};

/** `/rapports`: the company's figures over a period, department by department (ME33). */
export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authenticated/rapports' });
  const desk = useMediaQuery(DESK_WIDTH);
  const sync = useSync();
  const online = useOnline();
  const now = useMinuteClock();
  const period = search.periode ?? 'month';
  const report: Report | undefined = useLiveQuery(
    () => loadReport(db, period, now, t),
    [period, now],
  );
  const known = report && !awaitsServer(sync) ? report : undefined;
  const printed = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string>();
  const [kept, setKept] = useState<{ file: File; count: number }>();

  const exporting = useRef(false);

  const go = (
    next: { periode?: ReportPeriod; departement?: string },
    replace = true,
  ) => void navigate({ to: '/rapports', search: next, replace });

  const line = known?.lines.find((row) => row.id === search.departement);
  const lines = line ? [line] : (known?.lines ?? []);
  const figures = known
    ? toFigures(line ? { ...line } : known.totals)
    : UNKNOWN;
  const label = periodLabel(period, now);
  const scope = line ? nameOf(line) : t('reports.allDepartments');
  const subtitle = `${label} · ${scope}`;
  const chartIndexes = line
    ? [known!.lines.indexOf(line)]
    : (known?.lines ?? []).map((_, i) => i);
  const days = (known?.days ?? []).map(({ day, received }) => ({
    label: day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    values: chartIndexes.map((i) => received[i] ?? 0),
  }));
  const chartSubtitle = lines.map(nameOf).join(', ');
  const carriers = known
    ? carrierVolumes(
        known,
        lines.map(({ id }) => id),
      ).map(({ carrier, received }) => ({
        name: carrier || t('reports.carrier.unknown'),
        received: whole(received),
      }))
    : [];
  const stale = !sync.online || sync.status === 'error';
  const staleBanner = stale
    ? {
        title: t('dashboard.stale.title'),
        description: sync.lastSyncAt
          ? t('dashboard.stale.since', {
              time: syncedWhen(sync.lastSyncAt, now),
            })
          : t('dashboard.stale.description'),
        onRetry: () => void syncNow({ force: true }),
      }
    : undefined;

  const share = async (file: File, count: number) => {
    const outcome = await shareFile(file, t('export.share.title'));
    // Closed, or refused once the server took too long: the next touch only opens the sheet.
    if (outcome === 'cancelled' || outcome === 'blocked') {
      setKept({ file, count });
      setNote(t('export.ready'));
      return;
    }
    setKept(undefined);
    setNote(
      t(count > 1 ? 'export.done.many' : 'export.done.one', {
        count,
        time: clockTime(new Date()),
      }),
    );
  };

  const runExport = async () => {
    if (!known || exporting.current) return;
    exporting.current = true;
    try {
      if (kept) {
        await share(kept.file, kept.count);
        return;
      }
      const parcelIds = lines.flatMap(
        ({ id }) => known.parcelIds.get(id) ?? [],
      );
      if (!parcelIds.length) {
        setNote(t('reports.export.empty'));
        return;
      }
      const result = await trpcClient.exports.selectionCsv.mutate({
        parcelIds,
      });
      await share(csvFile(result), result.count);
    } catch (error) {
      console.error('Report export failed', error);
      setNote(t('export.failed'));
    } finally {
      exporting.current = false;
    }
  };

  const runPrint = () => {
    if (known && printed.current) {
      printAlone(printed.current, t('reports.title'), PRINT_CSS);
    }
  };

  const changePeriod = (id: string) => {
    setKept(undefined);
    setNote(undefined);
    go({ ...search, periode: id as ReportPeriod });
  };
  const changeDepartment = (id: string) => {
    setKept(undefined);
    setNote(undefined);
    go(
      id === ALL ? { periode: search.periode } : { ...search, departement: id },
    );
  };
  const offline = !online && !kept;
  const common = {
    periods: REPORT_PERIODS.map((id) => ({ id, label: PERIOD_LABEL[id] })),
    period,
    periodLabel: label,
    figures,
    lines: lines.map(toLine),
    carriers,
    note: offline ? t('export.offline') : note,
    exportDisabled: offline || !known,
    stale: staleBanner,
    onPeriod: changePeriod,
    onPrint: runPrint,
    onExport: () => void runExport(),
  };

  const print = (
    <div hidden ref={printed}>
      <RapportsPrint
        title={t('reports.title')}
        subtitle={subtitle}
        figures={figures}
        lines={common.lines}
        carriers={carriers}
        days={days}
        chartSubtitle={chartSubtitle}
      />
    </div>
  );

  if (desk) {
    return (
      <>
        <RapportsDesktop
          {...common}
          subtitle={subtitle}
          chartSubtitle={chartSubtitle}
          days={days}
          departments={[
            { value: ALL, label: t('reports.all') },
            ...(known?.lines ?? []).map((row) => ({
              value: row.id,
              label: nameOf(row),
            })),
          ]}
          department={line?.id ?? ALL}
          departmentLabel={line ? nameOf(line) : t('reports.all')}
          onDepartment={changeDepartment}
        />
        {print}
      </>
    );
  }

  const toSettings = () => void navigate({ to: '/reglages' });
  if (known?.empty) return <RapportsVideMobile onBack={toSettings} />;
  if (line) {
    return (
      <RapportsDepartementMobile
        name={nameOf(line)}
        periodLabel={label}
        figures={figures}
        lastDays={(known?.lastDays.get(line.id) ?? []).map(
          ({ received }) => received[0] ?? 0,
        )}
        stale={staleBanner}
        onBack={() => go({ periode: search.periode })}
      />
    );
  }
  return (
    <>
      <RapportsMobile
        {...common}
        onOpenLine={(departement) => go({ ...search, departement }, false)}
        onBack={toSettings}
      />
      {print}
    </>
  );
}
