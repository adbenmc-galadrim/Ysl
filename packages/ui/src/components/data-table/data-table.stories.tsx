import type { Meta, StoryObj } from '@storybook/react-vite';

import { DataTable, type DataTableColumn } from '#components/data-table';
import { DESK_PARCELS, type DeskParcel } from '#fixtures/desk';

const COLUMNS: DataTableColumn<DeskParcel>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 180,
    cell: (p) => <span className="truncate text-14 font-semibold">{p.recipient}</span>,
  },
  {
    key: 'department',
    header: 'Service',
    width: 160,
    cell: (p) => <span className="truncate text-14 text-ink-2">{p.department}</span>,
  },
  {
    key: 'received',
    header: 'Reçu',
    width: 80,
    cell: (p) => <span className="text-14 text-ink-2">{p.received}</span>,
  },
];

const meta = {
  title: 'Composants/DataTable',
  component: DataTable<DeskParcel>,
  parameters: { layout: 'padded' },
  args: {
    label: 'Colis',
    columns: COLUMNS,
    rows: DESK_PARCELS.slice(0, 4),
    rowKey: (p: DeskParcel) => p.id,
  },
} satisfies Meta<typeof DataTable<DeskParcel>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Colis: Story = {};

export const Cliquable: Story = { args: { onRowClick: () => {} } };
