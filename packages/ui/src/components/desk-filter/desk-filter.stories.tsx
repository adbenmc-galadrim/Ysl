import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeskFilterButton } from '#components/desk-filter';

const meta = {
  title: 'Composants/DeskFilterButton',
  component: DeskFilterButton,
  args: { label: 'Statut', value: 'Tous', className: 'w-[110px]' },
} satisfies Meta<typeof DeskFilterButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = { name: 'Par défaut' };
