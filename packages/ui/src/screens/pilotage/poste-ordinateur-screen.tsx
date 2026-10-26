import { Avatar } from '#components/avatar';
import { Button } from '#components/button';
import { DataTable, type DataTableColumn } from '#components/data-table';
import { DesktopShell } from '#components/desktop-shell';
import { FilterChip, FilterChips } from '#components/filter-chip';
import { SearchField } from '#components/search-field';
import { StatusDot, type StatusDotProps } from '#components/status-dot';
import { DESK_NAV, type DeskParcel } from '#fixtures/desk';
import type { ParcelState } from '#fixtures/parcels';
import { cn } from '#lib/tv';

/** The dot of each state: the hue of its tile on the phone. */
const STATE_TONE: Record<ParcelState, StatusDotProps['tone']> = {
  incomplete: 'red',
  toNotify: 'ink',
  notified: 'blue',
  late: 'orange',
  handedOver: 'green',
  returned: 'grey',
};

export type DeskFilter = { id: string; label: string; count: number };

export type PosteOrdinateurScreenProps = {
  parcels: DeskParcel[];
  filters: DeskFilter[];
  activeFilter: string;
  onFilterChange?: (id: string) => void;
};

// Penpot sets single-line text 1.5–2 px above the centre of a row; the
// margins below reproduce it per text style.
const COLUMNS: DataTableColumn<DeskParcel>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 180,
    cell: (p) => (
      <span
        className={cn(
          'mb-1 truncate text-14 font-semibold',
          p.uncertain && 'text-red',
        )}
      >
        {p.recipient}
      </span>
    ),
  },
  {
    key: 'department',
    header: 'Service',
    width: 160,
    cell: (p) => <span className="mb-1 truncate text-14 text-ink-2">{p.department}</span>,
  },
  {
    key: 'carrier',
    header: 'Transporteur',
    width: 120,
    cell: (p) => <span className="mb-1 truncate text-14 text-ink-2">{p.carrier}</span>,
  },
  {
    key: 'tracking',
    header: 'Suivi',
    width: 190,
    cell: (p) => (
      <span className="mb-[3px] truncate font-mono text-13 whitespace-pre">
        {p.tracking}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Statut',
    width: 160,
    cell: (p) => (
      <StatusDot tone={STATE_TONE[p.state]} label={p.status} className="mb-[3px]" />
    ),
  },
  {
    key: 'received',
    header: 'Reçu',
    width: 110,
    cell: (p) => <span className="mb-1 truncate text-14 text-ink-2">{p.received}</span>,
  },
  {
    key: 'agent',
    header: 'Agent',
    width: 76,
    cell: (p) => <Avatar initials={p.agent} size="sm" tone="fill" />,
  },
];

/**
 * The parcels on the reception desk's computer. Same data as the phone,
 * shown as a table: the agent at a desk compares rows, sorts by carrier,
 * copies a tracking number — what a phone list cannot do comfortably.
 */
export function PosteOrdinateurScreen({
  parcels,
  filters,
  activeFilter,
  onFilterChange,
}: PosteOrdinateurScreenProps) {
  return (
    <DesktopShell brand="Service courrier" nav={DESK_NAV} active="colis">
      <div className="flex flex-col pt-[22px] pr-5 pb-8 pl-8">
        <header className="flex items-center gap-3">
          <h1 className="mr-auto text-26 font-bold">Colis</h1>
          {/* The desktop keeps tighter corners than the phone's pills. */}
          <SearchField size="sm" className="w-[260px] min-w-[160px] shrink rounded-desk" />
          <Button size="sm" className="w-[88px] rounded-desk text-14">
            Exporter
          </Button>
        </header>
        <FilterChips aria-label="Filtres" className="mt-4">
          {filters.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              count={filter.count}
              selected={filter.id === activeFilter}
              onClick={() => onFilterChange?.(filter.id)}
              className="h-[30px] text-13 font-semibold"
            />
          ))}
        </FilterChips>
        <DataTable
          label="Colis"
          columns={COLUMNS}
          rows={parcels}
          rowKey={(p) => p.id}
          className="mt-5 -mr-1 -ml-4"
        />
      </div>
    </DesktopShell>
  );
}
