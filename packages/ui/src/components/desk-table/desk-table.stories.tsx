import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeskTable, DeskTablePagination } from '#components/desk-table';
import { PEOPLE } from '#fixtures/multi-entreprises';

type Row = { name: string; email: string };

const ROWS: Row[] = [PEOPLE.camille, PEOPLE.hugo, PEOPLE.ines].map((p) => ({
  name: p.name,
  email: p.email,
}));

const meta = {
  title: 'Composants/DeskTable',
  component: DeskTable<Row>,
  args: {
    label: 'Salariés',
    rows: ROWS,
    rowKey: (row) => row.name,
    className: 'w-[776px]',
    columns: [
      {
        key: 'name',
        header: 'Nom',
        width: 240,
        cell: (row) => <span className="font-semibold">{row.name}</span>,
      },
      { key: 'email', header: 'E-mail', cell: (row) => row.email },
    ],
  },
} satisfies Meta<typeof DeskTable<Row>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Simple: Story = {};

export const Selection: Story = {
  name: 'Sélection et ligne ouverte',
  args: {
    selectable: true,
    selected: ['Hugo Lefèvre'],
    activeRow: 'Camille Morel',
    footer: <DeskTablePagination range="1–3 sur 84" />,
  },
};
