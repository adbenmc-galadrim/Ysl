import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { SettingsIcon } from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { Screen } from '#components/screen';
import { StatusDot } from '#components/status-dot';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
} from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  DeskPanel,
  DeskStats,
  PhoneGroupTitle,
  PhoneStat,
} from '#screens/multi-entreprises/03-accueil/company-parts';

const TO_RESOLVE = [
  {
    name: 'Léa Fontaine',
    department: 'Finance',
    reason: 'Manquant au dépôt de 9:40',
    since: 'Il y a 1 h',
  },
  {
    name: 'Inès Garnier',
    department: 'Studio',
    reason: 'Manquant au dépôt de 10:56',
    since: 'Il y a 20 min',
  },
  {
    name: 'Paul Mercier',
    department: 'Juridique',
    reason: 'Salarié parti de l’entreprise',
    since: 'Hier',
  },
];

type DepartmentLine = {
  name: string;
  coming: string;
  waiting: string;
  late: string;
  blocked: string;
  deposit?: string;
  delay: string;
};

const DEPARTMENT_LINES: DepartmentLine[] = [
  {
    name: 'Studio',
    coming: '6',
    waiting: '12',
    late: '2',
    blocked: '1',
    deposit: 'Depuis 10:56',
    delay: '1,2 j',
  },
  {
    name: 'Finance',
    coming: '5',
    waiting: '8',
    late: '1',
    blocked: '1',
    delay: '1,6 j',
  },
  {
    name: 'Juridique',
    coming: '3',
    waiting: '17',
    late: '2',
    blocked: '1',
    delay: '2,4 j',
  },
  {
    name: 'Service courrier',
    coming: '—',
    waiting: '—',
    late: '—',
    blocked: '—',
    delay: '—',
  },
];

function figure(
  key: keyof DepartmentLine,
  header: string,
  width: number,
  tone?: string,
): DeskTableColumn<DepartmentLine> {
  return {
    key,
    header,
    width,
    cell: (line) => (
      <span
        className={cn(
          'ml-auto pr-6',
          line[key] !== '—' && tone && `font-semibold ${tone}`,
        )}
      >
        {line[key]}
      </span>
    ),
  };
}

const COLUMNS: DeskTableColumn<DepartmentLine>[] = [
  {
    key: 'name',
    header: 'Département',
    width: 220,
    cell: (line) => <span className="font-semibold">{line.name}</span>,
  },
  figure('coming', 'En route', 120),
  figure('waiting', 'En attente', 130),
  figure('late', 'En souffrance', 140, 'text-orange'),
  figure('blocked', 'À régulariser', 140, 'text-red'),
  {
    key: 'deposit',
    header: 'Dépôt à confirmer',
    width: 190,
    cell: (line) =>
      line.deposit ? (
        <StatusDot size="sm" tone="orange" label={line.deposit} />
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'delay',
    header: 'Délai moyen',
    cell: (line) => <span className="ml-auto pr-[54px]">{line.delay}</span>,
  },
];

/** What a company's administrator opens first: today's figures and what blocks. */
export function VueDEnsembleDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="vue-d-ensemble"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Vue d’ensemble')}
    >
      <DeskPageHeader
        title="Vue d’ensemble"
        subtitle="Aujourd’hui, mercredi 29 octobre · mis à jour à 11:04"
        actions={
          <Button variant="outline" size="desk" className="relative w-[120px]">
            Aujourd’hui
            <Icon
              name="chevron"
              size={12}
              className="absolute top-2.5 right-2.5 text-muted"
            />
          </Button>
        }
      />
      <DeskStats
        stats={[
          { label: 'En route', value: '14' },
          { label: 'En attente de retrait', value: '37' },
          { label: 'En souffrance', value: '5', tone: 'orange' },
          { label: 'À régulariser', value: '3', tone: 'red' },
          { label: 'Remis aujourd’hui', value: '22' },
        ]}
      />
      <DeskPanel
        title="À régulariser · 3"
        action="Tout voir"
        className="mt-5 h-[196px]"
      >
        {TO_RESOLVE.map((item, i) => (
          <div
            key={item.name}
            className={cn(
              'relative mx-[15px] flex h-12 shrink-0 items-start text-13',
              i < 2 && 'border-b border-separator',
            )}
          >
            <Icon name="warning" size={16} className="mt-[15px] text-red" />
            <span className="mt-[13px] ml-3 w-[156px] font-semibold">
              {item.name}
            </span>
            <span className="mt-[13px] w-[120px] text-ink-2">
              {item.department}
            </span>
            <span className="mt-[13px] w-[300px] text-ink-2">{item.reason}</span>
            <span className="mt-[13px] text-muted">{item.since}</span>
            <Button
              variant="outline"
              size="desk"
              className="absolute top-2 right-0 w-24"
            >
              Réaffecter
            </Button>
          </div>
        ))}
      </DeskPanel>
      <h2 className="mt-4 text-15 font-semibold">Par département</h2>
      <DeskTable
        label="Par département"
        className="mt-2.5 shrink-0"
        columns={COLUMNS}
        rows={DEPARTMENT_LINES}
        rowKey={(line) => line.name}
      />
      <p className="mt-[27px] text-12 text-muted">
        Une ligne ouvre les colis du département. Orange : attend une action ;
        rouge : bloque.
      </p>
    </CompanyShell>
  );
}

/** The same figures on the phone, and who has to be dealt with. */
export function VueDEnsembleMobile() {
  return (
    <Screen tone="fill" className="pt-[calc(var(--safe-top)+6px)]">
      <div className="flex h-11 items-center justify-end">
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5 bg-surface"
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Vue d’ensemble</span>}
        subtitle="Aujourd’hui, 11:04"
        className="mt-[7px] gap-1.5"
      />
      <div className="mt-3.5 grid grid-cols-2 gap-x-[11px] gap-y-3">
        <PhoneStat label="En route" value="14" />
        <PhoneStat label="En attente" value="37" />
        <PhoneStat label="En souffrance" value="5" tone="orange" />
        <PhoneStat label="À régulariser" value="3" tone="red" />
      </div>
      <PhoneGroupTitle className="mt-7">À régulariser</PhoneGroupTitle>
      <div className="mt-1.5 h-[192px] rounded-[14px] bg-surface">
        {TO_RESOLVE.map((item, i) => (
          <div key={item.name} className="relative h-16">
            {i > 0 && (
              <div className="absolute -top-px right-0 left-14 h-px bg-separator" />
            )}
            <SettingsIcon
              icon="warning"
              className="absolute top-[18px] left-3.5 bg-red"
            />
            <p className="absolute top-3 left-14 text-16 font-semibold">
              {item.name}
            </p>
            <p className="absolute top-[34px] left-14 text-13 text-muted">
              {item.department} · {item.reason}
            </p>
            <Icon
              name="chevron"
              size={16}
              className="absolute top-6 right-3.5 text-faint"
            />
          </div>
        ))}
      </div>
    </Screen>
  );
}
