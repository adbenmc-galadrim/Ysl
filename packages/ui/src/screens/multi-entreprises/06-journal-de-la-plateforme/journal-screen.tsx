import type { ComponentProps } from 'react';

import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskSelect } from '#components/desk-form';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { IconTile } from '#components/icon-tile';
import { PhoneNav, PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import type { PlatformChrome } from '#screens/multi-entreprises/03-accueil/entreprises-screen';
import { Skeleton } from '#components/skeleton';
import { ACCOUNT, COMPANY, crumbs, PLATFORM_NAV } from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

const KIND = {
  invitation: {
    label: 'Invitation',
    icon: 'mail',
    width: 96,
    tag: 'bg-fill text-ink',
    tile: 'bg-fill text-ink',
  },
  creation: {
    label: 'Création',
    icon: 'plus',
    width: 82.8,
    tag: 'bg-green-soft text-green',
    tile: 'bg-green-soft text-green',
  },
  suspension: {
    label: 'Suspension',
    icon: 'pause',
    width: 96,
    tag: 'bg-orange-soft text-orange-strong',
    tile: 'bg-orange-soft text-orange-strong',
  },
  deletion: {
    label: 'Suppression',
    icon: 'trash',
    width: 102.6,
    tag: 'bg-red-soft text-red',
    tile: 'bg-red-soft text-red',
  },
  reactivation: {
    label: 'Réactivation',
    icon: 'refresh',
    width: 102.6,
    tag: 'bg-green-soft text-green',
    tile: 'bg-green-soft text-green',
  },
  renaming: {
    label: 'Renommage',
    icon: 'edit',
    width: 102.6,
    tag: 'bg-fill text-ink',
    tile: 'bg-fill text-ink',
  },
} as const satisfies Record<
  string,
  { label: string; icon: IconName; width: number; tag: string; tile: string }
>;

export type JournalKind = keyof typeof KIND;

export type JournalLine = {
  id?: string;
  when: string;
  kind: keyof typeof KIND;
  action: string;
  company: string;
  detail: string;
  by: string;
};

const ENTRIES: JournalLine[] = [
  {
    when: 'Aujourd’hui, 9:14',
    kind: 'invitation',
    action: 'Invitation renvoyée',
    company: 'Groupe Novalis',
    detail: 'à leo.marchal@novalis-groupe.fr',
    by: 'SL',
  },
  {
    when: 'Hier, 18:02',
    kind: 'creation',
    action: 'Entreprise créée',
    company: 'Groupe Novalis',
    detail: 'Modèle Multi-départements',
    by: 'SL',
  },
  {
    when: 'Hier, 18:02',
    kind: 'invitation',
    action: 'Invitation envoyée',
    company: 'Groupe Novalis',
    detail: 'à leo.marchal@novalis-groupe.fr',
    by: 'SL',
  },
  {
    when: '21 oct., 14:02',
    kind: 'invitation',
    action: 'Invitation renvoyée',
    company: 'Atelier Lumen',
    detail: 'à marc.ollier@atelier-lumen.fr',
    by: 'SL',
  },
  {
    when: '17 oct., 11:30',
    kind: 'suspension',
    action: 'Entreprise suspendue',
    company: 'Studio Kerval',
    detail: 'Fin de contrat au 31 octobre',
    by: 'RD',
  },
  {
    when: '2 oct., 16:45',
    kind: 'deletion',
    action: 'Entreprise supprimée',
    company: 'Imprimerie Vasse',
    detail: '12 comptes, 940 colis effacés',
    by: 'RD',
  },
  {
    when: '3 sept., 10:15',
    kind: 'creation',
    action: 'Entreprise créée',
    company: 'Atelier Lumen',
    detail: 'Modèle Multi-départements',
    by: 'SL',
  },
];

const COLUMNS: DeskTableColumn<JournalLine>[] = [
  {
    key: 'when',
    header: 'Quand',
    width: 150,
    cell: (e) => <span className="text-muted">{e.when}</span>,
  },
  {
    key: 'kind',
    header: 'Type',
    width: 150,
    cell: (e) => (
      <span
        className={cn(
          'mt-[2.5px] flex h-[22px] items-center gap-1 rounded-[4px] pl-1.5 text-12 font-medium',
          KIND[e.kind].tag,
        )}
        style={{ width: KIND[e.kind].width }}
      >
        <Icon name={KIND[e.kind].icon} size={14} />
        {KIND[e.kind].label}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    width: 200,
    cell: (e) => <span className="font-semibold">{e.action}</span>,
  },
  {
    key: 'company',
    header: 'Entreprise',
    width: 180,
    cell: (e) => <span className="block w-[168px] truncate">{e.company}</span>,
  },
  { key: 'detail', header: 'Détail', width: 364, cell: (e) => e.detail },
  {
    key: 'by',
    header: 'Par',
    cell: (e) => (
      <span className="mt-[2.5px] flex size-6 items-center justify-center rounded-full bg-fill-2 text-[10px] font-semibold">
        {e.by}
      </span>
    ),
  },
];

const MOCK_FILTERS: ComponentProps<typeof DeskSelect>[] = [
  { icon: 'filter', label: 'Type', value: 'Tous', className: 'w-[123px]' },
  {
    icon: 'building',
    label: 'Entreprise',
    value: 'Toutes',
    className: 'w-[164px]',
  },
  {
    icon: 'calendar',
    label: 'Période',
    value: '30 derniers jours',
    className: 'w-[209px]',
  },
];

/** The real record: no export, no filter by company, a search instead. */
export type JournalData = {
  chrome?: PlatformChrome;
  searchPlaceholder: string;
  filters: ComponentProps<typeof DeskSelect>[];
  lines: JournalLine[];
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Instead of the lines: nothing found, or the server's refusal. */
  message?: string;
};

/** What was done on the platform, by whom, kept for twelve months. */
export function JournalDesktop({ data }: { data?: JournalData } = {}) {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="journal"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Journal')}
      searchPlaceholder={data?.searchPlaceholder ?? 'Entreprise ou personne'}
      {...data?.chrome}
    >
      <DeskPageHeader
        title="Journal"
        subtitle="Les actions faites sur la plateforme, gardées 12 mois"
        actions={
          data ? undefined : (
            <Button
              variant="outline"
              size="desk"
              icon="download"
              className="w-[103.6px] justify-start"
            >
              Exporter
            </Button>
          )
        }
      />
      <div className="mt-6 flex gap-2">
        {(data?.filters ?? MOCK_FILTERS).map((filter) => (
          <DeskSelect key={filter.label} {...filter} />
        ))}
      </div>
      {data?.message && (
        <p role="status" className="mt-4 text-13 text-muted">
          {data.message}
        </p>
      )}
      <DeskTable
        label="Journal de la plateforme"
        className="mt-4 shrink-0"
        columns={COLUMNS}
        rows={data?.lines ?? ENTRIES}
        rowKey={(e) => e.id ?? `${e.when}-${e.action}`}
        rowHeight={44}
        footer={
          <DeskTablePagination
            range={data?.range ?? '1–7 sur 42'}
            onPrevious={data?.onPrevious}
            onNext={data?.onNext}
          />
        }
      />
    </CompanyShell>
  );
}

function DayTitle({ children, first = false }: { children: string; first?: boolean }) {
  return (
    <h2 className={cn('mb-2 text-13 font-medium text-muted', first ? 'mt-4' : 'mt-2')}>
      {children}
    </h2>
  );
}

function JournalRow({
  kind,
  title,
  company,
  detail,
}: {
  kind: keyof typeof KIND;
  title: string;
  company: string;
  detail: string;
}) {
  return (
    <PhoneRow
      height={80}
      chevron={false}
      separator
      leading={
        <IconTile
          icon={KIND[kind].icon}
          tone="fill"
          className={KIND[kind].tile}
        />
      }
      title={title}
      lines={[company, detail]}
    />
  );
}

function JournalNav({ onBack }: { onBack?: () => void }) {
  return <PhoneNav title="Journal" onBack={onBack} />;
}

/** The record on the phone from real lines, by day, newest first. */
export function JournalListMobile({
  days,
  onBack,
  search,
  searchPlaceholder,
  moreLabel,
  onMore,
}: {
  days: { title: string; lines: JournalLine[] }[];
  onBack?: () => void;
  search?: { value: string; onChange: (value: string) => void };
  searchPlaceholder?: string;
  moreLabel?: string;
  onMore?: () => void;
}) {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav onBack={onBack} />
      {search && (
        <input
          type="search"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          className="mt-2 h-11 w-full shrink-0 rounded-full bg-fill px-4 text-15 outline-none"
        />
      )}
      {days.map((day, i) => (
        <div key={day.title}>
          <DayTitle first={i === 0}>{day.title}</DayTitle>
          {day.lines.map((line) => (
            <JournalRow
              key={line.id ?? `${line.when}-${line.action}`}
              kind={line.kind}
              title={line.action}
              company={line.company}
              detail={line.detail}
            />
          ))}
        </div>
      ))}
      {moreLabel && (
        <Button block variant="secondary" className="my-4" onClick={onMore}>
          {moreLabel}
        </Button>
      )}
    </Screen>
  );
}

/** The same record on the phone, by day. */
export function JournalMobile() {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav />
      <DayTitle first>Aujourd’hui</DayTitle>
      <JournalRow
        kind="invitation"
        title="Invitation renvoyée"
        company="Groupe Novalis"
        detail="à leo.marchal@novalis-groupe.fr"
      />
      <DayTitle>Hier</DayTitle>
      <JournalRow
        kind="creation"
        title="Entreprise créée"
        company="Groupe Novalis"
        detail="Modèle Multi-départements"
      />
      <JournalRow
        kind="invitation"
        title="Invitation envoyée"
        company="Groupe Novalis"
        detail="à leo.marchal@novalis-groupe.fr"
      />
      <DayTitle>Octobre</DayTitle>
      <JournalRow
        kind="invitation"
        title="Invitation renvoyée"
        company="Atelier Lumen"
        detail="à marc.ollier@atelier-lumen.fr"
      />
      <JournalRow
        kind="suspension"
        title="Entreprise suspendue"
        company="Studio Kerval"
        detail="Fin de contrat au 31 octobre"
      />
    </Screen>
  );
}

/** The record while it loads. */
export function JournalChargementMobile({
  onBack,
}: { onBack?: () => void } = {}) {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav onBack={onBack} />
      <Skeleton width={100} height={12} radius={6} className="mt-[18px]" />
      <div className="mt-[22px] flex flex-col gap-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton width={40} height={40} radius={20} />
            <div className="pt-1">
              <Skeleton width={158.85} height={14} radius={6} />
              <Skeleton width={105.9} height={12} radius={6} className="mt-2" />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** The record before anything has been done on the platform. */
export function JournalVideMobile({
  onBack,
  title = 'Aucune action',
  description = 'Les créations, invitations et suspensions apparaîtront ici.',
}: { onBack?: () => void; title?: string; description?: string } = {}) {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav onBack={onBack} />
      <div className="mt-40 flex flex-col text-center">
        <span className="ml-[132px] flex size-[88px] items-center justify-center rounded-full bg-fill">
          <Icon name="file" size={40} />
        </span>
        <h2 className="mt-5 ml-[26px] w-[300px] text-22 font-bold">{title}</h2>
        <p className="mt-[9px] ml-[26px] w-[300px] text-15 leading-5 text-muted">
          {description}
        </p>
      </div>
    </Screen>
  );
}
