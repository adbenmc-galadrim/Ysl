import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '#components/avatar';

const meta = {
  title: 'Composants/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Agent: Story = { args: { initials: 'KD', size: 'lg' } };
export const Annuaire: Story = { args: { name: 'Nora Haddad', tone: 'fill' } };
export const Selectionne: Story = { args: { initials: 'PM' } };
export const EnLigne: Story = {
  name: 'En ligne',
  args: { initials: 'SL', status: 'online', className: 'text-14' },
};
export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: { initials: 'TM', status: 'offline', className: 'text-14' },
};
export const Petit: Story = { args: { initials: 'KD', size: 'sm', tone: 'fill' } };
