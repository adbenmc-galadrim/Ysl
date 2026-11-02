import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { DeskPageHeader } from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { NavBar } from '#components/nav-bar';
import { PhoneStat } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SegmentedControl } from '#components/segmented-control';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  type OverviewProps,
  StaleBanner,
} from '#screens/multi-entreprises/03-accueil/vue-d-ensemble-screen';

export type ReportLine = {
  id: string;
  name: string;
  received: string;
  handed: string;
  delay: string;
  reminders: string;
  gaps: string;
  proof: string;
};

export type ReportFigures = {
  received: string;
  handed: string;
  delay: string;
  late: string;
  gaps: string;
};

export type ReportDay = {
  /** Said when hovering the bar: « 12 octobre ». */
  label: string;
  /** Parcels received, in the order of the lines. */
  values: number[];
};

export type ReportPeriodOption = { id: string; label: string };

type ReportCommon = {
  periods: ReportPeriodOption[];
  period: string;
  /** « Octobre 2026 ». */
  periodLabel: string;
  figures: ReportFigures;
  lines: ReportLine[];
  /** What the last export or print came to, when there is something to say. */
  note?: string;
  exportDisabled?: boolean;
  stale?: OverviewProps['stale'];
  onPeriod: (id: string) => void;
  onPrint: () => void;
  onExport: () => void;
};

export type RapportsDesktopProps = ReportCommon & {
  /** « Octobre 2026 · tous les départements ». */
  subtitle: string;
  /** « Studio, Finance, Juridique ». */
  chartSubtitle: string;
  days: ReportDay[];
  departments: { value: string; label: string }[];
  department: string;
  departmentLabel: string;
  onDepartment: (id: string) => void;
};

export type RapportsMobileProps = ReportCommon & {
  onOpenLine: (id: string) => void;
  onBack: () => void;
};

export type RapportsDepartementMobileProps = {
  name: string;
  periodLabel: string;
  figures: ReportFigures;
  /** Parcels received over the last ten days, today last. */
  lastDays: number[];
  onBack: () => void;
};

const SWATCHES = ['bg-ink', 'bg-muted', 'bg-faint', 'bg-blue', 'bg-orange', 'bg-red'];
const swatch = (index: number) => SWATCHES[index % SWATCHES.length];

function number(key: 'received' | 'handed' | 'delay' | 'reminders', header: string, width: number): DeskTableColumn<ReportLine> {
  return {
    key,
    header,
    width,
    cell: (row) => <span className="w-full pr-6 text-right">{row[key]}</span>,
  };
}

const COLUMNS: DeskTableColumn<ReportLine>[] = [
  {
    key: 'name',
    header: 'Département',
    width: 220,
    cell: (row) => <span className="font-semibold">{row.name}</span>,
  },
  number('received', 'Reçus', 140),
  number('handed', 'Remis', 140),
  number('delay', 'Délai moyen', 160),
  number('reminders', 'Relances', 140),
  {
    key: 'gaps',
    header: 'Écarts au dépôt',
    width: 160,
    cell: (row) => (
      <span className={cn('w-full pr-6 text-right font-semibold', row.gaps !== '0' && 'text-red')}>{row.gaps}</span>
    ),
  },
  { key: 'proof', header: 'Preuve la plus utilisée', cell: (row) => row.proof },
];

const CHART_HEIGHT = 190;
const CHART_WIDTH = 712;

function DeskCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-desk',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-desk after:border after:border-separator',
        className,
      )}
    >
      {children}
    </section>
  );
}

function DailyChart({ days }: { days: ReportDay[] }) {
  const totals = days.map((day) => day.values.reduce((sum, value) => sum + value, 0));
  const most = Math.max(1, ...totals);
  // A week spreads over the card; a month or more takes the mockup's pitch at most.
  const step = days.length <= 7 ? CHART_WIDTH / Math.max(1, days.length) : Math.min(24.6, CHART_WIDTH / days.length);
  return (
    <div role="img" aria-label="Colis reçus par jour, par département" className="absolute inset-x-0 bottom-5 h-[182px]">
      {days.map((day, i) => {
        const total = totals[i]!;
        if (!total) return null;
        const first = day.values.findIndex(Boolean);
        return (
          <span
            key={day.label}
            title={`${day.label} : ${total}`}
            className="absolute bottom-0 flex flex-col"
            style={{ left: 16 + i * step, width: Math.min(18, step * 0.73), height: (total / most) * CHART_HEIGHT }}
          >
            {day.values.map((value, line) =>
              value ? (
                <span
                  key={line}
                  className={cn(swatch(line), line === first && 'rounded-t-[2px]')}
                  style={{ height: `${(value / total) * 100}%` }}
                />
              ) : null,
            )}
          </span>
        );
      })}
    </div>
  );
}

function DeskFigures({ figures }: { figures: ReportFigures }) {
  const shown: { label: string; value: string; tone?: string }[] = [
    { label: 'Colis reçus', value: figures.received },
    { label: 'Remis', value: figures.handed },
    { label: 'Délai moyen de retrait', value: figures.delay },
    { label: 'En souffrance', value: figures.late, tone: 'text-orange' },
    { label: 'Écarts au dépôt', value: figures.gaps, tone: 'text-red' },
  ];
  return (
    <DeskCard className="mt-3.5 grid h-[76px] shrink-0 grid-cols-5">
      {shown.map((figure, i) => (
        <div key={figure.label} className="relative pt-3 pl-4">
          {i > 0 && <span className="absolute top-3 left-0 h-[52px] w-px bg-separator" />}
          <p className="text-12 font-medium text-muted">{figure.label}</p>
          <p className={cn('mt-[4px] text-22 font-bold', figure.tone)}>{figure.value}</p>
        </div>
      ))}
    </DeskCard>
  );
}

type ReportBodyProps = Pick<RapportsDesktopProps, 'figures' | 'lines' | 'days' | 'chartSubtitle'>;

function DeskReportBody({ figures, lines, days, chartSubtitle }: ReportBodyProps) {
  return (
    <>
      <DeskFigures figures={figures} />
      <div className="mt-5 flex shrink-0 gap-4">
        <DeskCard className="h-[300px] w-[744px]">
          <h2 className="mt-3 pl-4 text-14 font-semibold">Colis reçus par jour</h2>
          <p className="mt-[3px] truncate px-4 text-12 text-muted">{chartSubtitle}</p>
          <div className="absolute inset-x-0 top-[58px] h-px bg-separator" />
          <DailyChart days={days} />
        </DeskCard>
        <DeskCard className="h-[300px] w-[392px]">
          <div className="flex items-start justify-between px-4 pt-3">
            <h2 className="text-14 font-semibold">Par département</h2>
            <p className="mt-[3px] text-12 text-muted">Délai moyen de retrait</p>
          </div>
          <div className="absolute inset-x-0 top-11 h-px bg-separator" />
          <div className="absolute inset-x-0 top-[45px] bottom-0 overflow-y-auto">
            {lines.map((row, i) => (
              <div key={row.id} className="absolute inset-x-4 flex items-start" style={{ top: 19 + i * 56 }}>
                <span className={cn('mt-1 size-3 rounded-[3px]', swatch(i))} />
                <span className="ml-2.5 flex flex-col">
                  <span className="relative -top-px text-14 font-semibold">{row.name}</span>
                  <span className="mt-[2px] text-12 text-muted">{row.received} colis</span>
                </span>
                <span className="relative -top-px mt-2 ml-auto text-14 font-semibold">{row.delay}</span>
              </div>
            ))}
          </div>
        </DeskCard>
      </div>
      <DeskTable
        label="Rapport par département"
        className="mt-4 shrink-0"
        columns={COLUMNS}
        rows={lines}
        rowKey={(row) => row.id}
      />
    </>
  );
}

/** The period's report of the company, inside `CompanyShell`. */
export function RapportsDesktop({
  periods,
  period,
  subtitle,
  chartSubtitle,
  figures,
  lines,
  days,
  departments,
  department,
  departmentLabel,
  note,
  exportDisabled,
  stale,
  onPeriod,
  onDepartment,
  onPrint,
  onExport,
}: RapportsDesktopProps) {
  return (
    <>
      <DeskPageHeader
        title="Rapports"
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" size="desk" icon="file" className="w-[116px] justify-start" onClick={onPrint}>
              Rapport PDF
            </Button>
            <Button size="desk" icon="download" className="w-[140px] justify-start" disabled={exportDisabled} onClick={onExport}>
              Exporter en CSV
            </Button>
          </>
        }
      />
      {stale && <StaleBanner stale={stale} className="my-3" />}
      <DeskTabs
        label="Période"
        active={period}
        onChange={onPeriod}
        className="mt-2 [&>button:nth-child(2)]:mr-1"
        tabs={periods.map(({ id, label }, i) => ({ id, label, width: [55.8, 29.6][i] }))}
      />
      <DeskFilterButton
        label="Département"
        value={departmentLabel}
        choices={departments}
        selected={department}
        onSelect={onDepartment}
        className="mt-[15px] w-[150px]"
      />
      {note && (
        <p role="status" className="mt-2 text-13 text-muted">
          {note}
        </p>
      )}
      <DeskReportBody figures={figures} lines={lines} days={days} chartSubtitle={chartSubtitle} />
    </>
  );
}

/** What « Rapport PDF » prints: the page without its controls. */
export function RapportsPrint({ title, subtitle, ...body }: ReportBodyProps & { title: string; subtitle: string }) {
  return (
    <div className="flex w-[1152px] flex-col bg-surface text-ink">
      <DeskPageHeader title={title} subtitle={subtitle} />
      <DeskReportBody {...body} />
    </div>
  );
}

function PhoneFigures({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[171px_171px] gap-x-[11px] gap-y-3', className)}>
      {children}
    </div>
  );
}

/** The period's report on the phone: four figures, then each department. */
export function RapportsMobile({
  periods,
  period,
  periodLabel,
  figures,
  lines,
  note,
  exportDisabled,
  stale,
  onPeriod,
  onOpenLine,
  onBack,
  onPrint,
  onExport,
}: RapportsMobileProps) {
  const label = (id: string) => periods.find((option) => option.id === id)?.label ?? id;
  return (
    <Screen
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <Button variant="secondary" icon="file" iconSize={20} className="w-[170.5px] gap-2 px-0" onClick={onPrint}>
            Rapport PDF
          </Button>
          <Button icon="download" iconSize={20} className="w-[170.5px] gap-2 px-0" disabled={exportDisabled} onClick={onExport}>
            Exporter en CSV
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="Rapports" onBack={onBack} />
      <SegmentedControl
        label="Période"
        value={label(period)}
        options={periods.map((option) => option.label)}
        onChange={(value) => {
          const chosen = periods.find((option) => option.label === value);
          if (chosen) onPeriod(chosen.id);
        }}
        className="mt-4 h-9 gap-0 bg-fill-2 p-0.5 [&_button]:pb-[3px] [&_button:not([aria-checked=true])]:text-ink-2"
      />
      {stale && <StaleBanner stale={stale} className="mt-3.5" />}
      <p className="mt-5 text-15 text-muted">{periodLabel}</p>
      <PhoneFigures className="mt-3.5">
        <PhoneStat value={figures.received} label="reçus" className="bg-fill" />
        <PhoneStat value={figures.handed} label="remis" className="bg-fill" />
        <PhoneStat value={figures.delay} label="délai moyen" className="bg-fill" />
        <PhoneStat value={figures.late} label="en souffrance" tone="orange" className="bg-fill" />
      </PhoneFigures>
      <h2 className="relative -top-px mt-6 text-13 font-medium text-muted">Par département</h2>
      <div className="mt-1.5 rounded-[14px] bg-fill">
        {lines.map((row, i) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpenLine(row.id)}
            className="relative flex h-[52px] w-full cursor-pointer items-start pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            <span className="mt-[17px] truncate text-16">{row.name}</span>
            <span className="mt-[17px] ml-auto pl-3 text-16 whitespace-nowrap text-muted">
              {row.received} · {row.delay}
            </span>
            <Icon name="chevron" size={16} className="mt-[18px] mr-3.5 ml-1.5 shrink-0 text-faint" />
            {i < lines.length - 1 && (
              <span className="absolute right-0 bottom-0 left-4 h-px bg-separator" />
            )}
          </button>
        ))}
      </div>
      {note && (
        <p role="status" className="mt-3 text-13 text-muted">
          {note}
        </p>
      )}
    </Screen>
  );
}

const DEPARTMENT_CHART_HEIGHT = 140;

/** One department's period on the phone, with its last ten days. */
export function RapportsDepartementMobile({
  name,
  periodLabel,
  figures,
  lastDays,
  onBack,
}: RapportsDepartementMobileProps) {
  const most = Math.max(1, ...lastDays);
  return (
    <Screen>
      <NavBar title={name} onBack={onBack} />
      <p className="mt-4 text-15 text-muted">{periodLabel}</p>
      <PhoneFigures className="mt-3.5">
        <PhoneStat value={figures.received} label="reçus" className="bg-fill" />
        <PhoneStat value={figures.handed} label="remis" className="bg-fill" />
        <PhoneStat value={figures.delay} label="délai moyen" className="bg-fill" />
        <PhoneStat value={figures.gaps} label="écarts au dépôt" tone="red" className="bg-fill" />
      </PhoneFigures>
      <h2 className="mt-6 text-17 font-semibold">Colis reçus par jour</h2>
      <div role="img" aria-label="Colis reçus sur les dix derniers jours" className="mt-[15px] flex h-[140px] items-end gap-2">
        {lastDays.map((count, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-[4px]', i === lastDays.length - 1 ? 'bg-ink' : 'bg-faint')}
            style={{ height: (count / most) * DEPARTMENT_CHART_HEIGHT }}
          />
        ))}
      </div>
    </Screen>
  );
}
