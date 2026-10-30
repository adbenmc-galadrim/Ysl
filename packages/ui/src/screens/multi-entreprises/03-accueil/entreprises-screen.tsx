import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { IconButton } from '#components/icon-button';
import { LargeTitle } from '#components/large-title';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { StatusDot } from '#components/status-dot';
import {
  ACCOUNT,
  COMPANIES,
  COMPANY,
  crumbs,
  PLATFORM_NAV,
  type Company,
} from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  CompanyLogo,
  CompanyPill,
  DeskSelect,
  DeskStats,
  PhoneListRow,
} from '#screens/multi-entreprises/03-accueil/company-parts';

const STATUS_DOT = {
  active: 'green',
  invited: 'blue',
  suspended: 'orange',
} as const;

function Right({ children }: { children: ReactNode }) {
  return <span className="ml-auto">{children}</span>;
}

const COLUMNS: DeskTableColumn<Company>[] = [
  {
    key: 'name',
    header: 'Entreprise',
    width: 260,
    cell: (c) => (
      <span className="flex items-center gap-2.5">
        <CompanyLogo
          initials={c.initials}
          size={24}
          muted={c.status !== 'active'}
          className="mt-[2.5px]"
        />
        <span className="font-semibold">{c.name}</span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Statut',
    width: 190,
    cell: (c) => (
      <StatusDot size="sm" tone={STATUS_DOT[c.status]} label={c.statusLabel} />
    ),
  },
  { key: 'profile', header: 'Modèle de profil', width: 200, cell: (c) => c.profile },
  {
    key: 'departments',
    header: <span className="block text-right">Départements</span>,
    width: 96,
    cell: (c) => <Right>{c.departments}</Right>,
  },
  {
    key: 'accounts',
    header: <span className="block text-right">Comptes</span>,
    width: 100,
    cell: (c) => <Right>{c.accounts}</Right>,
  },
  {
    key: 'parcels',
    header: <span className="block text-right">Colis du mois</span>,
    width: 130,
    cell: (c) => <Right>{c.parcels}</Right>,
  },
  {
    key: 'activity',
    header: <span className="block pl-6">Dernière activité</span>,
    cell: (c) => <span className="pl-6 text-muted">{c.lastActivity}</span>,
  },
];

const TABS = [
  { label: 'Toutes', width: 44, count: 5 },
  { label: 'Actives', width: 46, count: 3 },
  { label: 'Invitation envoyée', width: 112, count: 1 },
  { label: 'Suspendues', width: 77, count: 1 },
];

function CompanyTabs() {
  return (
    <div
      role="tablist"
      aria-label="Entreprises par statut"
      className="mt-7 flex h-[29px] shrink-0 gap-6 border-b border-separator"
    >
      {TABS.map((tab, i) => (
        <button
          key={tab.label}
          type="button"
          role="tab"
          aria-selected={i === 0}
          className={cn(
            'flex h-7 cursor-pointer items-start gap-1.5 border-b-2 text-14 outline-none',
            i === 0
              ? 'border-ink font-semibold'
              : 'border-transparent font-medium text-muted',
          )}
        >
          <span className="-mt-px whitespace-nowrap" style={{ width: tab.width }}>
            {tab.label}
          </span>
          <span
            className={cn(
              'flex h-[18px] w-5 items-center justify-center rounded-full pb-1 text-11 font-semibold',
              i === 0 ? 'bg-ink text-on-ink' : 'bg-fill text-muted',
            )}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function PlatformShell({
  searchPlaceholder,
  children,
}: {
  searchPlaceholder: string;
  children: ReactNode;
}) {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="entreprises"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Entreprises')}
      searchPlaceholder={searchPlaceholder}
    >
      {children}
    </CompanyShell>
  );
}

/** The platform's home: its clients, as figures and never as their content. */
export function EntreprisesDesktop() {
  return (
    <PlatformShell searchPlaceholder="Rechercher une entreprise">
      <DeskPageHeader
        title="Entreprises"
        subtitle="5 entreprises clientes · chiffres d’octobre"
        actions={
          <Button
            size="desk"
            icon="plus"
            className="w-[182.8px] justify-start"
          >
            Nouvelle entreprise
          </Button>
        }
      />
      <DeskStats
        className="mt-6"
        stats={[
          { label: 'Entreprises actives', value: '3' },
          { label: 'Comptes', value: '76' },
          { label: 'Colis en octobre', value: '1 900' },
          { label: 'Invitation en attente', value: '1', tone: 'orange' },
        ]}
      />
      <CompanyTabs />
      <div className="mt-[19px] flex gap-2">
        <DeskSelect
          icon="filter"
          label="Modèle"
          value="Tous"
          className="w-[137px]"
        />
        <DeskSelect
          icon="list"
          label="Tri"
          value="Dernière activité"
          className="w-[176px]"
        />
      </div>
      <DeskTable
        label="Entreprises clientes"
        className="mt-4 shrink-0"
        columns={COLUMNS}
        rows={COMPANIES}
        rowKey={(c) => c.id}
        rowHeight={44}
        footer={<DeskTablePagination range="1–5 sur 5" />}
      />
      <p className="mt-[18px] flex items-center gap-2 text-12 text-muted">
        <Icon name="lock" size={14} className="mt-0.5" />
        Chiffres seulement : ni colis, ni annuaire, ni nom de salarié (D26).
      </p>
    </PlatformShell>
  );
}

/** The same list when the server does not answer. */
export function EntreprisesErreurDesktop() {
  return (
    <PlatformShell searchPlaceholder="Rechercher une entreprise">
      <DeskPageHeader title="Entreprises" subtitle="Liste non chargée" />
      <div className="mt-[175px] flex flex-col items-center text-center">
        <span className="flex size-[88px] items-center justify-center rounded-full bg-red-soft text-red">
          <Icon name="wifiOff" size={44} />
        </span>
        <h2 className="mt-5 text-22 font-bold">Impossible de charger</h2>
        <p className="mt-2 w-[320px] text-15 leading-5 text-muted">
          Le serveur ne répond pas. Vérifiez la connexion puis réessayez. Rien
          n’a été modifié.
        </p>
        <Button
          icon="refresh"
          iconSize={24}
          className="mt-[25px] h-12 w-[180px] gap-[7px] text-16"
        >
          Réessayer
        </Button>
      </div>
    </PlatformShell>
  );
}

function CompanyRow({
  company,
  separator,
  lines,
}: {
  company: Company;
  separator: boolean;
  lines: string[];
}) {
  return (
    <PhoneListRow
      height={80}
      leading={<CompanyLogo initials={company.initials} size={40} />}
      title={company.name}
      lines={lines}
      separator={separator}
    />
  );
}

/** The same home on the phone: active clients, then those to keep an eye on. */
export function EntreprisesMobile() {
  const [lumen, ferrand, meran, novalis, kerval] = COMPANIES as [
    Company,
    Company,
    Company,
    Company,
    Company,
  ];
  return (
    <Screen
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <SearchTrigger size="dock" />
          <Button icon="plus" iconSize={20} className="w-[171px] gap-2">
            Nouvelle
          </Button>
        </BottomBar>
      }
    >
      <div className="flex h-11 items-center justify-end">
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5"
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Entreprises</span>}
        subtitle="3 actives · 1 900 colis en octobre"
        className="mt-[7px] gap-1.5"
      />
      <SectionHeader
        title={<span className="inline-block w-[78px]">Actives</span>}
        count={3}
        size="lg"
        className="mt-[23px] h-[27px]"
      />
      <div className="mt-3.5">
        <CompanyRow
          company={lumen}
          separator
          lines={['4 départements · 42 comptes', '1 284 colis · il y a 5 min']}
        />
        <CompanyRow
          company={ferrand}
          separator
          lines={['1 départements · 6 comptes', '412 colis · hier, 17:20']}
        />
        <CompanyRow
          company={meran}
          separator
          lines={['3 départements · 18 comptes', '204 colis · aujourd’hui, 9:02']}
        />
      </div>
      <SectionHeader
        title={<span className="inline-block w-[84px]">À suivre</span>}
        count={2}
        size="lg"
        className="mt-[15px] h-[27px]"
      />
      <div className="mt-3.5">
        <PhoneListRow
          height={76}
          leading={<CompanyLogo initials={novalis.initials} size={40} muted />}
          title={novalis.name}
          lines={[novalis.profile]}
          trailing={<CompanyPill tone="blue" label={novalis.statusLabel} className="relative -top-px w-[140px]" />}
          separator
        />
        <PhoneListRow
          height={76}
          leading={<CompanyLogo initials={kerval.initials} size={40} muted />}
          title={kerval.name}
          lines={[kerval.profile]}
          trailing={<CompanyPill tone="orange" label={kerval.statusLabel} className="relative -top-px w-[100px]" />}
        />
      </div>
    </Screen>
  );
}
