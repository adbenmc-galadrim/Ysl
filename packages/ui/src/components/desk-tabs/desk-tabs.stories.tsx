import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeskTabs } from '#components/desk-tabs';

const meta = {
  title: 'Composants/DeskTabs',
  component: DeskTabs,
  args: {
    label: 'Colis',
    active: 'presents',
    tabs: [
      { id: 'a-venir', label: 'À venir 6' },
      { id: 'presents', label: 'Présents 12' },
      { id: 'historique', label: 'Historique' },
    ],
  },
} satisfies Meta<typeof DeskTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Presents: Story = { name: 'Présents' };
