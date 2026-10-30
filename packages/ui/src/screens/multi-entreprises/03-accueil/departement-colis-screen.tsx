import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { DetailsList } from '#components/details-list';
import { IconButton } from '#components/icon-button';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { ListRow, type ListRowLine } from '#components/list-row';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { StatusDot } from '#components/status-dot';
import { StatusPill, SYNC_PILL } from '#components/status-pill';
import {
  ACCOUNT,
  COMPANY,
  crumbs,
  DEPARTMENT_NAV,
  type StudioParcel,
} from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

const COLUMNS: DeskTableColumn<StudioParcel>[] = [
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
        tone={p.state === 'late' ? 'orange' : 'blue'}
        label={p.status}
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

function ParcelPanelLabel() {
  return (
    <div className="relative mt-5 h-[170px] rounded-[16px] bg-kraft px-5 pt-3.5">
      <div className="h-[142px] rounded-[4px] bg-paper pt-2.5 pl-3">
        <p className="text-[10px] leading-3 font-semibold text-label-ink-3">
          Destinataire :
        </p>
        <p className="mt-1 font-label text-24 font-bold text-label-ink">
          C. MOREL
        </p>
        <p className="mt-1 text-[9px] leading-3 text-label-line">
          12 RUE DES ATELIERS
          <br />
          75011 PARIS FR
        </p>
      </div>
      <span className="absolute top-[130px] left-[288px] flex size-7 items-center justify-center rounded-full bg-white text-black">
        <Icon name="zoom" size={14} />
      </span>
    </div>
  );
}

function ParcelPanel() {
  return (
    <aside className="relative flex h-[560px] w-[360px] shrink-0 flex-col rounded-desk border border-separator p-[15px]">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-16 font-bold">Camille Morel</h2>
          <p className="mt-[3px] text-12 text-muted">Studio · poste 214</p>
        </div>
        <Icon name="x" size={16} className="text-muted" />
      </div>
      <ParcelPanelLabel />
      <div className="-mx-[15px] mt-4 h-px bg-separator" />
      <DetailsList
        variant="desk"
        className="mt-3.5"
        items={[
          { label: 'Suivi', value: '1Z E63 44W 04 9923 0622' },
          { label: 'Arrivé', value: '10:56, dépôt de Karim' },
          { label: 'E-mail', value: 'Délivré à 10:58' },
          { label: 'Code de retrait', value: '4821' },
        ]}
      />
      <Button
        variant="outline"
        size="desk"
        icon="bell"
        className="mt-[33px] w-full justify-start"
      >
        Relancer
      </Button>
    </aside>
  );
}

export type DepartementColisDesktopProps = {
  parcels: StudioParcel[];
  activeParcel: string;
};

/**
 * The department's home on the computer: the deposit waiting for its count,
 * the parcels present, and the record of the row that is open.
 */
export function DepartementColisDesktop({
  parcels,
  activeParcel,
}: DepartementColisDesktopProps) {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="colis"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis')}
      searchPlaceholder="Nom, suivi, transporteur"
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
      <Banner
        tone="orange"
        icon="truck"
        iconSize={18}
        title="Karim a posé 6 colis à 10:56"
        description="Comptez-les puis confirmez : les salariés seront prévenus."
        className="h-14 shrink-0 gap-2.5 rounded-desk py-0 pr-4 pl-4"
        classNames={{
          title: 'mt-[9px] text-14',
          description: 'mt-[3px] text-13 leading-4',
        }}
        action={
          <Button size="desk" className="w-[136px]">
            Confirmer le dépôt
          </Button>
        }
      />
      <DeskTabs
        label="Colis du département"
        active="presents"
        className="mt-4"
        tabs={[
          { id: 'a-venir', label: 'À venir 6', width: 53 },
          { id: 'presents', label: 'Présents 12', width: 73 },
          { id: 'historique', label: 'Historique' },
        ]}
      />
      <div className="mt-[15px] flex gap-2">
        <DeskFilterButton label="Statut" value="Tous" className="w-[110px]" />
        <DeskFilterButton
          label="Arrivé"
          value="Cette semaine"
          className="w-[170px]"
        />
      </div>
      <div className="mt-3 flex items-start gap-4">
        <DeskTable
          label="Colis présents"
          className="w-[776px] shrink-0"
          columns={COLUMNS}
          rows={parcels}
          rowKey={(p) => p.id}
          selectable
          activeRow={activeParcel}
          footer={<DeskTablePagination range="1–5 sur 12" />}
        />
        <ParcelPanel />
      </div>
    </CompanyShell>
  );
}

function PhoneRow({
  tile,
  tileClass,
  title,
  lines,
  separator = false,
}: {
  tile: IconTileProps['icon'];
  tileClass?: string;
  title: ReactNode;
  lines: ListRowLine[];
  separator?: boolean;
}) {
  const tall = lines.length > 1;
  const raised = lines.map((line) => ({
    ...line,
    text: <span className="relative -top-px">{line.text}</span>,
  }));
  return (
    <div
      className={
        tall ? 'relative h-[76px] pt-3' : 'relative h-[60px] pt-[11px]'
      }
    >
      <ListRow
        leading={
          <IconTile
            icon={tile}
            tone="fill"
            className={cn(tall ? '-mt-px' : '-mt-2', tileClass)}
          />
        }
        title={title}
        lines={raised}
        trailing={
          <Icon
            name="chevron"
            size={16}
            className={tall ? 'mt-[7px] text-faint' : 'text-faint'}
          />
        }
      />
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
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
          tile="clock"
          tileClass="bg-orange-soft text-orange-strong"
          title="Inès Garnier"
          lines={[
            { text: 'FedEx ···3338' },
            {
              text: (
                <span className="text-orange">En souffrance, relancée hier</span>
              ),
            },
          ]}
          separator
        />
        <PhoneRow
          tile="mail"
          title="Camille Morel"
          lines={[{ text: 'UPS ···0622' }, { text: 'Prévenue à 10:58' }]}
          separator
        />
        <PhoneRow
          tile="mail"
          title="Samuel Petit"
          lines={[{ text: '2 colis Amazon' }, { text: 'A ouvert l’e-mail à 11:02' }]}
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
          tile="truck"
          title="Jules Perret"
          lines={[{ text: 'DPD · en route' }]}
        />
      </div>
    </Screen>
  );
}
