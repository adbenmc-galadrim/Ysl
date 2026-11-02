import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import {
  CompanyShell,
  type CompanyShellProps,
  DeskPageHeader,
} from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { type DeskTab, DeskTabs } from '#components/desk-tabs';
import { DetailsList, type DetailsItem } from '#components/details-list';
import { IconButton } from '#components/icon-button';
import { IconTile } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { StatusDot } from '#components/status-dot';
import { StatusPill, SYNC_PILL } from '#components/status-pill';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type DepartementParcelRow = {
  id: string;
  recipient: string;
  /** `late` draws the orange dot, `present` the blue one, `coming` the grey one. */
  state: 'present' | 'late' | 'coming';
  status: string;
  carrier: string;
  tracking: string;
  arrived: string;
};

const DOT_TONE = { present: 'blue', late: 'orange', coming: 'grey' } as const;

const COLUMNS: DeskTableColumn<DepartementParcelRow>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 160,
    cell: (p) => <span className="font-semibold">{p.recipient}</span>,
  },
  {
    key: 'status',
    header: 'Statut',
    width: 140,
    cell: (p) => (
      <StatusDot
        size="sm"
        tone={DOT_TONE[p.state]}
        label={p.status}
        className={p.state === 'coming' ? '[&>span:first-child]:bg-muted' : undefined}
      />
    ),
  },
  { key: 'carrier', header: 'Transporteur', width: 110, cell: (p) => p.carrier },
  {
    key: 'tracking',
    header: 'Suivi',
    width: 200,
    cell: (p) => (
      <span className="mt-0.5 font-mono text-12 whitespace-pre">{p.tracking}</span>
    ),
  },
  {
    key: 'arrived',
    header: 'Arrivé',
    cell: (p) => <span className="text-muted">{p.arrived}</span>,
  },
];

export type DepartementParcelPanelProps = {
  recipient: string;
  place: string;
  details: DetailsItem[];
  onClose?: () => void;
  /** The whole record, with its actions. */
  onOpen?: () => void;
  openLabel: string;
  /** Offered while the recipient has not collected. */
  onRemind?: () => void;
  remindLabel?: string;
};

/** No label photo: it stays on the shuttle's iPhone (D8, §3.7.9). */
function ParcelPanel({
  recipient,
  place,
  details,
  onClose,
  onOpen,
  openLabel,
  onRemind,
  remindLabel,
}: DepartementParcelPanelProps) {
  return (
    <aside className="relative flex w-[360px] shrink-0 flex-col rounded-desk border border-separator p-[15px]">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-16 font-bold">{recipient}</h2>
          <p className="mt-[3px] text-12 text-muted">{place}</p>
        </div>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          className="cursor-pointer text-muted"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="-mx-[15px] mt-4 h-px bg-separator" />
      <DetailsList variant="desk" className="mt-3.5" items={details} />
      {onRemind && remindLabel && (
        <Button
          variant="outline"
          size="desk"
          icon="bell"
          className="mt-[33px] w-full justify-start"
          onClick={onRemind}
        >
          {remindLabel}
        </Button>
      )}
      <Button
        variant="outline"
        size="desk"
        className={cn('w-full', onRemind ? 'mt-2' : 'mt-[33px]')}
        onClick={onOpen}
      >
        {openLabel}
      </Button>
    </aside>
  );
}

export type DepartementFilter = {
  label: string;
  value: string;
  choices: readonly { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  className?: string;
};

export type DepartementDesktopProps = Pick<
  CompanyShellProps,
  'company' | 'nav' | 'account' | 'onNavigate' | 'search' | 'searchPlaceholder'
> & {
  breadcrumb: CompanyShellProps['breadcrumb'];
  subtitle: string;
  tabs: DeskTab[];
  activeTab: string;
  onTab?: (id: string) => void;
  filters: DepartementFilter[];
  onExport?: () => void;
  exportNote?: string;
  /** On a computer the employee's QR is out of reach: code or name only (D23). */
  onHandover?: () => void;
  /** The deposit waiting to be counted. */
  deposit?: {
    title: string;
    description: string;
    action: string;
    onAction?: () => void;
  };
  children: ReactNode;
};

/** What every tab of the department's computer page shares. */
export function DepartementDesktop({
  subtitle,
  tabs,
  activeTab,
  onTab,
  filters,
  onExport,
  exportNote,
  onHandover,
  deposit,
  children,
  ...shell
}: DepartementDesktopProps) {
  return (
    <CompanyShell {...shell} active="colis">
      <DeskPageHeader
        title="Colis"
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {exportNote && (
              <span className="text-13 text-muted">{exportNote}</span>
            )}
            {onHandover && (
              <Button
                variant="outline"
                size="desk"
                icon="qr"
                className="justify-start"
                onClick={onHandover}
              >
                Remettre
              </Button>
            )}
            <Button
              variant="outline"
              size="desk"
              icon="download"
              className="w-[104px] justify-start"
              onClick={onExport}
            >
              Exporter
            </Button>
          </div>
        }
      />
      {deposit && (
        <Banner
          tone="orange"
          icon="truck"
          iconSize={18}
          title={deposit.title}
          description={deposit.description}
          className="h-14 shrink-0 gap-2.5 rounded-desk py-0 pr-4 pl-4"
          classNames={{
            title: 'mt-[9px] text-14',
            description: 'mt-[3px] text-13 leading-4',
          }}
          action={
            <Button size="desk" className="w-[136px]" onClick={deposit.onAction}>
              {deposit.action}
            </Button>
          }
        />
      )}
      <DeskTabs
        label="Colis du département"
        active={activeTab}
        onChange={onTab}
        className={deposit ? 'mt-4' : 'mt-2'}
        tabs={tabs}
      />
      <div className="mt-[15px] flex gap-2">
        {filters.map((filter) => (
          <DeskFilterButton key={filter.label} {...filter} />
        ))}
      </div>
      {children}
    </CompanyShell>
  );
}

export type DepartementColisDesktopProps = Omit<
  DepartementDesktopProps,
  'children'
> & {
  label: string;
  parcels: DepartementParcelRow[];
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
  empty?: { title: string; description: string };
  activeParcel?: string;
  onParcel?: (id: string) => void;
  panel?: DepartementParcelPanelProps;
};

/**
 * The department's home on the computer: the deposit waiting for its count,
 * the parcels of the tab, and the record of the row that is open.
 */
export function DepartementColisDesktop({
  label,
  parcels,
  range,
  onPrevious,
  onNext,
  empty,
  activeParcel,
  onParcel,
  panel,
  ...page
}: DepartementColisDesktopProps) {
  return (
    <DepartementDesktop {...page}>
      {empty ? (
        <DeskEmpty {...empty} />
      ) : (
        <div className="mt-3 flex items-start gap-4">
          <DeskTable
            label={label}
            className="min-w-0 flex-1"
            shrink
            columns={COLUMNS}
            rows={parcels}
            rowKey={(p) => p.id}
            activeRow={activeParcel}
            onRowClick={(p) => onParcel?.(p.id)}
            footer={
              <DeskTablePagination
                range={range}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            }
          />
          {panel && <ParcelPanel {...panel} />}
        </div>
      )}
    </DepartementDesktop>
  );
}

export function DeskEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-24 flex flex-col items-center text-center">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-fill">
        <Icon name="inbox" size={32} />
      </span>
      <h2 className="mt-5 text-18 font-bold">{title}</h2>
      <p className="relative -top-px mt-2 text-13 text-muted">{description}</p>
    </div>
  );
}

/** The same home on the phone: the deposit, then who has a parcel waiting. */
export function DepartementColisMobile() {
  return (
    <Screen
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <SearchTrigger size="dock" />
          <Button icon="qr" iconSize={20} className="w-[171px] gap-2">
            Remettre
          </Button>
        </BottomBar>
      }
    >
      <div className="flex h-11 items-center justify-between">
        <StatusPill {...SYNC_PILL.synced} size="sm" />
        <IconButton icon="menu" label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5"
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Colis</span>}
        subtitle="Studio · 12 présents, 6 à venir"
        className="mt-[7px] gap-1.5"
      />
      <Banner
        tone="orange"
        icon="truck"
        title="Karim a posé 6 colis"
        description={
          <>
            Comptez-les et confirmez.
            <span className="mt-[9px] block text-15 font-semibold">
              Confirmer le dépôt
            </span>
          </>
        }
        className="mt-3.5 h-[93px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
        classNames={{
          icon: 'mt-4',
          title: 'mt-[15px] text-15',
          description: 'mt-0.5 text-13 leading-4',
        }}
      />
      <SectionHeader
        title="Présents"
        count={12}
        size="lg"
        className="mt-5 h-[27px]"
      />
      <div className="mt-3.5">
        <PhoneRow
          leading={
            <IconTile icon="clock" tone="fill" className="bg-orange-soft text-orange-strong" />
          }
          title="Inès Garnier"
          lines={[
            'FedEx ···3338',
            <span key="state" className="text-orange">En souffrance, relancée hier</span>,
          ]}
          separator
        />
        <PhoneRow
          leading={<IconTile icon="mail" tone="fill" />}
          title="Camille Morel"
          lines={['UPS ···0622', 'Prévenue à 10:58']}
          separator
        />
        <PhoneRow
          leading={<IconTile icon="mail" tone="fill" />}
          title="Samuel Petit"
          lines={['2 colis Amazon', 'A ouvert l’e-mail à 11:02']}
        />
      </div>
      <SectionHeader
        title="À venir"
        count={6}
        size="lg"
        className="mt-[19px] h-[27px]"
      />
      <div className="mt-3.5">
        <PhoneRow
          leading={<IconTile icon="truck" tone="fill" />}
          title="Jules Perret"
          lines={['DPD · en route']}
          height={60}
        />
      </div>
    </Screen>
  );
}
