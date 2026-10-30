import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { NavBar } from '#components/nav-bar';
import { PhoneStat } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SegmentedControl } from '#components/segmented-control';
import { ACCOUNT, COMPANY, COMPANY_ADMIN_NAV, crumbs } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

type DepartmentReport = {
  name: string;
  received: string;
  handed: string;
  delay: string;
  reminders: string;
  gaps: string;
  proof: string;
  swatch: string;
};

const REPORT: DepartmentReport[] = [
  { name: 'Studio', received: '548', handed: '532', delay: '1,2 j', reminders: '61', gaps: '2', proof: 'QR code', swatch: 'bg-ink' },
  { name: 'Finance', received: '402', handed: '391', delay: '1,6 j', reminders: '74', gaps: '1', proof: 'Code', swatch: 'bg-muted' },
  { name: 'Juridique', received: '334', handed: '318', delay: '2,4 j', reminders: '96', gaps: '1', proof: 'Signature', swatch: 'bg-faint' },
];

const DAILY_TOTALS: [day: number, total: number][] = [
  [0, 98.8], [1, 135.2], [2, 158.6], [3, 114.4], [4, 182],
  [7, 127.4], [8, 150.8], [9, 171.6], [10, 106.6], [11, 189.8],
  [14, 143], [15, 122.2], [16, 161.2], [17, 153.4], [18, 176.8],
  [21, 132.6], [22, 166.4], [23, 148.2], [24, 156], [25, 187.2],
  [28, 124.8],
];

function number(key: keyof DepartmentReport, header: string, width: number): DeskTableColumn<DepartmentReport> {
  return {
    key,
    header,
    width,
    cell: (row) => <span className="w-full pr-6 text-right">{row[key]}</span>,
  };
}

const COLUMNS: DeskTableColumn<DepartmentReport>[] = [
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
      <span className="w-full pr-6 text-right font-semibold text-red">{row.gaps}</span>
    ),
  },
  { key: 'proof', header: 'Preuve la plus utilisée', cell: (row) => row.proof },
];

const DESK_FIGURES: { label: string; value: string; tone?: string }[] = [
  { label: 'Colis reçus', value: '1 284' },
  { label: 'Remis', value: '1 241' },
  { label: 'Délai moyen de retrait', value: '1,4 j' },
  { label: 'En souffrance', value: '9', tone: 'text-orange' },
  { label: 'Écarts au dépôt', value: '4', tone: 'text-red' },
];

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

function DailyChart() {
  return (
    <div role="img" aria-label="Colis reçus par jour, par département" className="absolute inset-x-0 bottom-5 h-[182px]">
      {DAILY_TOTALS.map(([day, total]) => (
        <span
          key={day}
          className="absolute bottom-0 flex w-[18px] flex-col"
          style={{ left: 16 + day * 24.6, height: total }}
        >
          <span className="rounded-t-[2px] bg-ink" style={{ height: '45%' }} />
          <span className="bg-muted" style={{ height: '30%' }} />
          <span className="bg-faint" style={{ height: '25%' }} />
        </span>
      ))}
    </div>
  );
}

/** The month's report of the whole company, on the computer. */
export function RapportsDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="rapports"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Rapports')}
    >
      <DeskPageHeader
        title="Rapports"
        subtitle="Octobre 2026 · tous les départements"
        actions={
          <>
            <Button variant="outline" size="desk" icon="file" className="w-[116px] justify-start">
              Rapport PDF
            </Button>
            <Button size="desk" icon="download" className="w-[140px] justify-start">
              Exporter en CSV
            </Button>
          </>
        }
      />
      <DeskTabs
        label="Période"
        active="mois"
        className="mt-2 [&>button:nth-child(2)]:mr-1"
        tabs={[
          { id: 'semaine', label: 'Semaine', width: 55.8 },
          { id: 'mois', label: 'Mois', width: 29.6 },
          { id: 'trimestre', label: 'Trimestre' },
        ]}
      />
      <DeskFilterButton label="Département" value="Tous" className="mt-[15px] w-[150px]" />
      <DeskCard className="mt-3.5 grid h-[76px] shrink-0 grid-cols-5">
        {DESK_FIGURES.map((figure, i) => (
          <div key={figure.label} className="relative pt-3 pl-4">
            {i > 0 && <span className="absolute top-3 left-0 h-[52px] w-px bg-separator" />}
            <p className="text-12 font-medium text-muted">{figure.label}</p>
            <p className={cn('mt-[4px] text-22 font-bold', figure.tone)}>{figure.value}</p>
          </div>
        ))}
      </DeskCard>
      <div className="mt-5 flex shrink-0 gap-4">
        <DeskCard className="h-[300px] w-[744px]">
          <h2 className="mt-3 pl-4 text-14 font-semibold">Colis reçus par jour</h2>
          <p className="mt-[3px] pl-4 text-12 text-muted">Studio, Finance, Juridique</p>
          <div className="absolute inset-x-0 top-[58px] h-px bg-separator" />
          <DailyChart />
        </DeskCard>
        <DeskCard className="h-[300px] w-[392px]">
          <div className="flex items-start justify-between px-4 pt-3">
            <h2 className="text-14 font-semibold">Par département</h2>
            <p className="mt-[3px] text-12 text-muted">Délai moyen de retrait</p>
          </div>
          <div className="absolute inset-x-0 top-11 h-px bg-separator" />
          {REPORT.map((row, i) => (
            <div key={row.name} className="absolute inset-x-4 flex items-start" style={{ top: 64 + i * 56 }}>
              <span className={cn('mt-1 size-3 rounded-[3px]', row.swatch)} />
              <span className="ml-2.5 flex flex-col">
                <span className="relative -top-px text-14 font-semibold">{row.name}</span>
                <span className="mt-[2px] text-12 text-muted">{row.received} colis</span>
              </span>
              <span className="relative -top-px mt-2 ml-auto text-14 font-semibold">{row.delay}</span>
            </div>
          ))}
        </DeskCard>
      </div>
      <DeskTable
        label="Rapport par département"
        className="mt-4 shrink-0"
        columns={COLUMNS}
        rows={REPORT}
        rowKey={(row) => row.name}
      />
    </CompanyShell>
  );
}

function PhoneFigures({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[171px_171px] gap-x-[11px] gap-y-3', className)}>
      {children}
    </div>
  );
}

/** The month's report on the phone: four figures, then each department. */
export function RapportsMobile() {
  return (
    <Screen
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <Button variant="secondary" icon="file" iconSize={20} className="w-[170.5px] gap-2 px-0">
            Rapport PDF
          </Button>
          <Button icon="download" iconSize={20} className="w-[170.5px] gap-2 px-0">
            Exporter en CSV
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="Rapports" />
      <SegmentedControl
        label="Période"
        value="Mois"
        options={['Semaine', 'Mois', 'Trimestre']}
        className="mt-4 h-9 gap-0 bg-fill-2 p-0.5 [&_button]:pb-[3px] [&_button:not([aria-checked=true])]:text-ink-2"
      />
      <p className="mt-5 text-15 text-muted">Octobre 2026</p>
      <PhoneFigures className="mt-3.5">
        <PhoneStat value="1 284" label="reçus" className="bg-fill" />
        <PhoneStat value="1 241" label="remis" className="bg-fill" />
        <PhoneStat value="1,4 j" label="délai moyen" className="bg-fill" />
        <PhoneStat value="9" label="en souffrance" tone="orange" className="bg-fill" />
      </PhoneFigures>
      <h2 className="relative -top-px mt-6 text-13 font-medium text-muted">Par département</h2>
      <div className="mt-1.5 rounded-[14px] bg-fill">
        {REPORT.map((row, i) => (
          <div key={row.name} className="relative flex h-[52px] items-start pl-4">
            <span className="mt-[17px] text-16">{row.name}</span>
            <span className="mt-[17px] ml-auto text-16 text-muted">
              {row.received} · {row.delay}
            </span>
            <Icon name="chevron" size={16} className="mt-[18px] mr-3.5 ml-1.5 text-faint" />
            {i < REPORT.length - 1 && (
              <span className="absolute right-0 bottom-0 left-4 h-px bg-separator" />
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}

const DEPARTMENT_DAYS = [93.33, 127.27, 110.3, 76.36, 131.52, 84.85, 114.55, 106.06, 123.03, 140];

/** One department's month on the phone, with its last ten days. */
export function RapportsDepartementMobile() {
  return (
    <Screen>
      <NavBar title="Studio" />
      <p className="mt-4 text-15 text-muted">Octobre 2026</p>
      <PhoneFigures className="mt-3.5">
        <PhoneStat value="548" label="reçus" className="bg-fill" />
        <PhoneStat value="532" label="remis" className="bg-fill" />
        <PhoneStat value="1,2 j" label="délai moyen" className="bg-fill" />
        <PhoneStat value="2" label="écarts au dépôt" tone="red" className="bg-fill" />
      </PhoneFigures>
      <h2 className="mt-6 text-17 font-semibold">Colis reçus par jour</h2>
      <div role="img" aria-label="Colis reçus sur les dix derniers jours" className="mt-[15px] flex h-[140px] items-end gap-2">
        {DEPARTMENT_DAYS.map((height, i) => (
          <span
            key={height}
            className={cn('flex-1 rounded-[4px]', i === DEPARTMENT_DAYS.length - 1 ? 'bg-ink' : 'bg-faint')}
            style={{ height }}
          />
        ))}
      </div>
    </Screen>
  );
}
