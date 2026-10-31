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
} as const satisfies Record<
  string,
  { label: string; icon: IconName; width: number; tag: string; tile: string }
>;

type Entry = {
  when: string;
  kind: keyof typeof KIND;
  action: string;
  company: string;
  detail: string;
  by: string;
};

const ENTRIES: Entry[] = [
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

const COLUMNS: DeskTableColumn<Entry>[] = [
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
  { key: 'company', header: 'Entreprise', width: 180, cell: (e) => e.company },
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

/** What was done on the platform, by whom, kept for twelve months. */
export function JournalDesktop() {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="journal"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Journal')}
      searchPlaceholder="Entreprise ou personne"
    >
      <DeskPageHeader
        title="Journal"
        subtitle="Les actions faites sur la plateforme, gardées 12 mois"
        actions={
          <Button
            variant="outline"
            size="desk"
            icon="download"
            className="w-[103.6px] justify-start"
          >
            Exporter
          </Button>
        }
      />
      <div className="mt-6 flex gap-2">
        <DeskSelect icon="filter" label="Type" value="Tous" className="w-[123px]" />
        <DeskSelect
          icon="building"
          label="Entreprise"
          value="Toutes"
          className="w-[164px]"
        />
        <DeskSelect
          icon="calendar"
          label="Période"
          value="30 derniers jours"
          className="w-[209px]"
        />
      </div>
      <DeskTable
        label="Journal de la plateforme"
        className="mt-4 shrink-0"
        columns={COLUMNS}
        rows={ENTRIES}
        rowKey={(e) => `${e.when}-${e.action}`}
        rowHeight={44}
        footer={<DeskTablePagination range="1–7 sur 42" />}
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

function JournalNav() {
  return <PhoneNav title="Journal" />;
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
export function JournalChargementMobile() {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav />
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
export function JournalVideMobile() {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <JournalNav />
      <div className="mt-40 flex flex-col text-center">
        <span className="ml-[132px] flex size-[88px] items-center justify-center rounded-full bg-fill">
          <Icon name="file" size={40} />
        </span>
        <h2 className="mt-5 ml-[26px] w-[300px] text-22 font-bold">Aucune action</h2>
        <p className="mt-[9px] ml-[26px] w-[300px] text-15 leading-5 text-muted">
          Les créations, invitations et suspensions apparaîtront ici.
        </p>
      </div>
    </Screen>
  );
}
