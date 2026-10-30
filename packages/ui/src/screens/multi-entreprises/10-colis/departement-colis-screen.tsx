import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Chip } from '#components/chip';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { IconButton } from '#components/icon-button';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { StatusDot, type StatusDotProps } from '#components/status-dot';
import {
  ACCOUNT,
  COMPANY,
  crumbs,
  DEPARTMENT_NAV,
} from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  PhoneSection,
} from '#screens/multi-entreprises/10-colis/phone-parts';

type Handover = {
  id: string;
  recipient: string;
  tone: StatusDotProps['tone'];
  status: string;
  to: string;
  proof?: { icon: IconName; label: string; width: number };
  by: string;
  when: string;
};

const HANDOVERS: Handover[] = [
  {
    id: 'malik',
    recipient: 'Malik Benali',
    tone: 'green',
    status: 'Remis',
    to: 'Malik Benali',
    proof: { icon: 'qr', label: 'QR code', width: 76.2 },
    by: 'Julie Perrin',
    when: 'Aujourd’hui, 11:05',
  },
  {
    id: 'axelle',
    recipient: 'Axelle Bernard',
    tone: 'green',
    status: 'Remis',
    to: 'Axelle Bernard',
    proof: { icon: 'hash', label: 'Code', width: 56.4 },
    by: 'Thomas Moreau',
    when: 'Aujourd’hui, 9:58',
  },
  {
    id: 'romain',
    recipient: 'Romain Garnier',
    tone: 'green',
    status: 'Remis',
    to: 'Lucie Hamel (collègue)',
    proof: { icon: 'sign', label: 'Signature', width: 89.4 },
    by: 'Julie Perrin',
    when: 'Hier, 17:12',
  },
  {
    id: 'paul',
    recipient: 'Paul Roy',
    tone: 'green',
    status: 'Remis',
    to: 'Paul Roy',
    proof: { icon: 'qr', label: 'QR code', width: 76.2 },
    by: 'Julie Perrin',
    when: 'Hier, 16:40',
  },
  {
    id: 'clara',
    recipient: 'Clara Sennet',
    tone: 'red',
    status: 'À régulariser',
    to: '—',
    by: 'Karim Daoud',
    when: 'Lun., 10:58',
  },
  {
    id: 'yves',
    recipient: 'Yves Morin',
    tone: 'grey',
    status: 'Retourné',
    to: 'Transporteur',
    by: 'Julie Perrin',
    when: 'Ven., 15:00',
  },
];

const HISTORY_COLUMNS: DeskTableColumn<Handover>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 190,
    cell: (h) => <span className="font-semibold">{h.recipient}</span>,
  },
  {
    key: 'status',
    header: 'Statut',
    width: 150,
    cell: (h) => (
      <StatusDot
        size="sm"
        tone={h.tone}
        label={h.status}
        className={h.tone === 'grey' ? '[&>span:first-child]:bg-muted' : undefined}
      />
    ),
  },
  { key: 'to', header: 'Remis à', width: 190, cell: (h) => h.to },
  {
    key: 'proof',
    header: 'Preuve',
    width: 220,
    cell: (h) =>
      h.proof ? (
        <span
          className="mt-[2.5px] flex h-[22px] items-center gap-1 rounded-[4px] bg-fill pl-1.5 text-12 font-medium text-ink-2"
          style={{ width: h.proof.width }}
        >
          <Icon name={h.proof.icon} size={14} />
          {h.proof.label}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  { key: 'by', header: 'Par', width: 150, cell: (h) => h.by },
  {
    key: 'when',
    header: 'Quand',
    cell: (h) => <span className="text-muted">{h.when}</span>,
  },
];

/** The department's past handovers: who took what, with which proof. */
export function HistoriqueDesktop() {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="colis"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis', 'Historique')}
    >
      <DeskPageHeader
        title="Colis"
        subtitle="Studio · Bât. A, 2e étage, accueil"
        actions={
          <Button
            variant="outline"
            size="desk"
            icon="download"
            className="w-[104px] justify-start"
          >
            Exporter
          </Button>
        }
      />
      <DeskTabs
        label="Colis du département"
        active="historique"
        className="mt-2"
        tabs={[
          { id: 'a-venir', label: 'À venir 6', width: 53 },
          { id: 'presents', label: 'Présents 12', width: 69 },
          { id: 'historique', label: 'Historique' },
        ]}
      />
      <div className="mt-[15px] flex gap-2">
        <DeskFilterButton
          label="Période"
          value="30 derniers jours"
          className="w-[190px]"
        />
        <DeskFilterButton label="Preuve" value="Toutes" className="w-[120px]" />
      </div>
      <DeskTable
        label="Historique des remises"
        className="mt-3"
        columns={HISTORY_COLUMNS}
        rows={HANDOVERS}
        rowKey={(h) => h.id}
        footer={<DeskTablePagination range="1–6 sur 214" />}
      />
    </CompanyShell>
  );
}

const DoneTile = () => (
  <IconTile icon="check" tone="fill" className="bg-green-soft text-green" />
);

function DayLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('relative -top-px h-4 text-13 font-medium text-muted', className)}>
      {children}
    </p>
  );
}

/** The same record on the phone, by day. */
export function HistoriqueMobile() {
  return (
    <Screen>
      <NavBar title="Historique" />
      <DayLabel className="mt-4">Aujourd’hui</DayLabel>
      <div className="mt-2">
        <PhoneRow
          leading={<DoneTile />}
          title="Malik Benali"
          lines={['QR code · par Julie']}
          separator
        />
        <PhoneRow
          leading={<DoneTile />}
          title="Axelle Bernard"
          lines={['Code · par Thomas']}
          separator
        />
      </div>
      <DayLabel className="mt-3">Hier</DayLabel>
      <div className="mt-2">
        <PhoneRow
          leading={<DoneTile />}
          title="Romain Garnier"
          lines={['Retiré par Lucie Hamel · signature']}
          separator
        />
        <PhoneRow
          leading={<DoneTile />}
          title="Paul Roy"
          lines={['QR code · par Julie']}
          separator
        />
      </div>
    </Screen>
  );
}

const TIMELINE: { label: string; x: number; state: 'done' | 'current' | 'todo' }[] = [
  { label: 'Reçu', x: 30, state: 'done' },
  { label: 'En route', x: 141, state: 'done' },
  { label: 'Déposé', x: 252, state: 'current' },
  { label: 'Remis', x: 363, state: 'todo' },
];

function ParcelTimeline() {
  return (
    <ol className="relative -mx-5 mt-[30px] h-[39px] shrink-0">
      <span aria-hidden="true" className="absolute top-2 left-[30px] h-0.5 w-[333px] bg-separator" />
      <span aria-hidden="true" className="absolute top-2 left-[30px] h-0.5 w-[222px] bg-ink" />
      {TIMELINE.map((step) => (
        <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined}>
          {step.state === 'current' ? (
            <span
              className="absolute top-0 flex size-[18px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-ink bg-surface"
              style={{ left: step.x }}
            >
              <span className="size-2 rounded-full bg-ink" />
            </span>
          ) : (
            <span
              className={cn(
                'absolute top-[3px] size-3 -translate-x-1/2 rounded-full',
                step.state === 'done' ? 'bg-ink' : 'border-[1.5px] border-faint bg-surface',
              )}
              style={{ left: step.x }}
            />
          )}
          <span
            className={cn(
              'absolute top-[25px] w-20 -translate-x-1/2 text-center text-12',
              step.state === 'current' && 'font-semibold',
              step.state === 'todo' && 'text-muted',
            )}
            style={{ left: step.x }}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ParcelLabelPhoto() {
  return (
    <div className="relative mt-[26px] h-[150px] shrink-0 rounded-[16px] bg-kraft px-5 pt-3.5">
      <div className="h-[122px] rounded-[4px] bg-paper pt-2.5 pl-3">
        <p className="text-[10px] leading-3 font-semibold text-label-ink-3">
          Destinataire :
        </p>
        <p className="mt-1 font-label text-24 font-bold text-label-ink">C. MOREL</p>
        <p className="mt-1 text-[9px] leading-3 text-label-line">
          12 RUE DES ATELIERS
          <br />
          75011 PARIS FR
        </p>
      </div>
      <span className="absolute top-[110px] left-[313px] flex size-7 items-center justify-center rounded-full bg-white text-black">
        <Icon name="zoom" size={14} />
      </span>
    </div>
  );
}

const EVENTS = [
  { title: 'Dépôt confirmé au Studio', detail: '10:58, par Julie Perrin', last: true },
  { title: 'En route vers le Studio', detail: '10:52, par Karim' },
  { title: 'Reçu et scanné', detail: '10:31, par Karim' },
];

/** A parcel's record in the department: where it stands, its label, its history. */
export function FicheColisMobile() {
  return (
    <Screen
      bottom={
        <BottomBar className="justify-between gap-0 pt-[34px] pb-[26px]">
          <Button variant="secondary" icon="bell" iconSize={20} className="w-[150px] gap-2 px-0">
            Relancer
          </Button>
          <Button icon="qr" iconSize={20} className="w-[170.5px] gap-2 px-0">
            Remettre
          </Button>
        </BottomBar>
      }
    >
      <NavBar trailing={<IconButton icon="edit" label="Modifier" size="lg" iconSize={22} />} />
      <h1 className="mt-3 text-30 font-bold">Camille Morel</h1>
      <p className="mt-1.5 flex h-[18px] items-center gap-1.5 text-15 text-muted">
        <Icon name="building" size={14} />
        Studio · poste 214
      </p>
      <p className="mt-4 flex h-[18px] items-center justify-between text-15">
        <span className="font-mono">1Z E63 44W 04 9923 0622</span>
        <span className="text-muted">UPS</span>
      </p>
      <PhoneBanner
        icon="package"
        title="Présent au Studio depuis 10:56"
        description="Nora a été prévenue à 10:58 ; e-mail délivré."
        height={67}
        descriptionClassName="text-ink"
        className="mt-4"
      />
      <ParcelTimeline />
      <ParcelLabelPhoto />
      <h2 className="mt-[22px] h-6 text-20 font-bold">Historique</h2>
      <ol className="mt-2.5 flex flex-col gap-3">
        {EVENTS.map((event) => (
          <li key={event.title} className="relative h-[34px] pl-5">
            <span
              className={cn(
                'absolute top-1.5 left-0.5 size-2 rounded-full',
                event.last ? 'bg-ink' : 'bg-faint',
              )}
            />
            <p className="text-15 font-semibold">{event.title}</p>
            <p className="relative -top-px mt-0.5 text-13 leading-4 text-muted">
              {event.detail}
            </p>
          </li>
        ))}
      </ol>
    </Screen>
  );
}

const SEARCH_FILTERS = [
  { label: 'Tout', width: 60, selected: true },
  { label: 'En route', width: 92 },
  { label: 'Présents', width: 92 },
  { label: 'À régulariser', width: 132 },
  { label: 'Remis', width: 68 },
];

const tile = (icon: IconTileProps['icon'], className: string) => (
  <IconTile icon={icon} tone="fill" className={className} />
);

/** Search across the states, handed-over parcels included. */
export function RechercheMobile() {
  return (
    <Screen>
      <div className="-mt-0.5 flex h-11 items-center gap-3">
        <SearchField
          size="bar"
          value="garn"
          readOnly
          className="w-[290px] flex-none gap-2 rounded-[12px] pl-3 text-16"
        />
        <NavBarAction className="font-normal">Annuler</NavBarAction>
      </div>
      <div className="-mr-5 mt-4 flex gap-2 overflow-hidden">
        {SEARCH_FILTERS.map((filter) => (
          <Chip
            key={filter.label}
            selected={filter.selected}
            className={cn(
              'h-[34px] rounded-[17px] px-0 pb-1 text-14 font-semibold',
              !filter.selected && 'bg-fill ring-0',
            )}
            style={{ width: filter.width }}
          >
            {filter.label}
          </Chip>
        ))}
      </div>
      <PhoneSection title="Présents" count={1} className="mt-[22px]" />
      <div className="mt-2.5">
        <PhoneRow
          leading={tile('clock', 'bg-orange-soft text-orange-strong')}
          title="Inès Garnier"
          lines={[
            'Studio · FedEx ···3338',
            <span key="late" className="text-orange">
              En souffrance, relancée hier
            </span>,
          ]}
        />
      </div>
      <PhoneSection title="Remis" count={2} className="mt-5" />
      <div className="mt-2.5">
        <PhoneRow
          leading={<DoneTile />}
          title="Romain Garnier"
          lines={['Finance · UPS ···1209', 'Remis le 14 oct.']}
          separator
        />
        <PhoneRow
          leading={<DoneTile />}
          title="Inès Garnier"
          lines={['Studio · DHL ···5580', 'Remis le 2 oct.']}
          separator
        />
      </div>
      <p className="relative -top-[0.5px] -left-[1.5px] mt-[22px] px-1 text-center text-13 leading-[15.6px] text-muted">
        Recherche sur le nom, le département, le suivi, l’expéditeur et le
        transporteur.
      </p>
    </Screen>
  );
}

/** Several parcels ticked: chase them or move them together. */
export function SelectionMobile() {
  return (
    <Screen
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <Button variant="secondary" icon="bell" iconSize={20} className="min-w-0 flex-1 gap-2 px-0">
            Relancer 3
          </Button>
          <Button variant="secondary" icon="move" iconSize={20} className="min-w-0 flex-1 gap-2 px-0">
            Déplacer…
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        back={false}
        leading={<NavBarAction className="font-normal">Tout sélectionner</NavBarAction>}
        trailing={<NavBarAction>OK</NavBarAction>}
      />
      <LargeTitle
        title={<span className="tracking-[-0.4px]">3 colis sélectionnés</span>}
        className="mt-2"
      />
      <PhoneSection title="Présents" count={3} className="mt-[23px]" />
      <div className="mt-2.5">
        {[
          ['Inès Garnier', 'Studio · FedEx ···3338'],
          ['Camille Morel', 'Studio · UPS ···0622'],
          ['Hugo Lefèvre', 'Studio · DHL ···7112'],
        ].map(([name, line]) => (
          <PhoneRow
            key={name}
            leading={<KraftThumb />}
            title={name}
            lines={[line]}
            trailing="tick"
            separator
          />
        ))}
      </div>
    </Screen>
  );
}
