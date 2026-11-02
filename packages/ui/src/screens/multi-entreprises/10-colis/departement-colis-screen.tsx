import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Chip } from '#components/chip';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { IconButton } from '#components/icon-button';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  PhoneSection,
  TickMark,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { StatusDot, type StatusDotProps } from '#components/status-dot';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import {
  DepartementDesktop,
  type DepartementDesktopProps,
  DeskEmpty,
} from '#screens/multi-entreprises/03-accueil/departement-colis-screen';

export type DepartementHistoryRow = {
  id: string;
  recipient: string;
  tone: StatusDotProps['tone'];
  status: string;
  to: string;
  proof?: { icon: IconName; label: string };
  by: string;
  when: string;
};

const HISTORY_COLUMNS: DeskTableColumn<DepartementHistoryRow>[] = [
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
          className="mt-[2.5px] inline-flex h-[22px] items-center gap-1 rounded-[4px] bg-fill px-1.5 text-12 font-medium text-ink-2"
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

export type HistoriqueDesktopProps = Omit<DepartementDesktopProps, 'children'> & {
  rows: DepartementHistoryRow[];
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onRow?: (id: string) => void;
  empty?: { title: string; description: string };
};

/** The department's past handovers: who took what, with which proof. */
export function HistoriqueDesktop({
  rows,
  range,
  onPrevious,
  onNext,
  onRow,
  empty,
  ...page
}: HistoriqueDesktopProps) {
  return (
    <DepartementDesktop {...page}>
      {empty ? (
        <DeskEmpty {...empty} />
      ) : (
        <DeskTable
          label="Historique des remises"
          className="mt-3"
          columns={HISTORY_COLUMNS}
          rows={rows}
          rowKey={(h) => h.id}
          onRowClick={(h) => onRow?.(h.id)}
          footer={
            <DeskTablePagination
              range={range}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          }
        />
      )}
    </DepartementDesktop>
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

export type HistoriqueDay = {
  title: string;
  rows: {
    id: string;
    title: string;
    line: string;
    /** Left out of the handed over: held back, or back with the carrier. */
    closed?: 'toSettle' | 'returned';
  }[];
};

export type HistoriqueMobileProps = {
  title: string;
  days: HistoriqueDay[];
  empty?: string;
  onBack?: () => void;
  onRow?: (id: string) => void;
};

/** The same record on the phone, by day. */
export function HistoriqueMobile({
  title,
  days,
  empty,
  onBack,
  onRow,
}: HistoriqueMobileProps) {
  return (
    <Screen>
      <NavBar title={title} onBack={onBack} />
      {days.length === 0 && (
        <p className="mt-10 text-center text-15 text-muted">{empty}</p>
      )}
      {days.map((day, index) => (
        <div key={day.title}>
          <DayLabel className={index === 0 ? 'mt-4' : 'mt-3'}>{day.title}</DayLabel>
          <div className="mt-2">
            {day.rows.map((row, rowIndex) => (
              <button
                key={row.id}
                type="button"
                className="block w-full cursor-pointer text-left"
                onClick={() => onRow?.(row.id)}
              >
                <PhoneRow
                  leading={
                    row.closed === 'toSettle' ? (
                      <IconTile icon="alert" tone="fill" className="bg-red/12 text-red" />
                    ) : row.closed === 'returned' ? (
                      <IconTile icon="undo" tone="fill" />
                    ) : (
                      <DoneTile />
                    )
                  }
                  title={row.title}
                  lines={[row.line]}
                  separator={rowIndex < day.rows.length - 1 || index < days.length - 1}
                />
              </button>
            ))}
          </div>
        </div>
      ))}
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
            mark={<TickMark />}
            separator
          />
        ))}
      </div>
    </Screen>
  );
}
