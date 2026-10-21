import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusDot } from '#components/status-dot';

const meta = {
  title: 'Composants/StatusDot',
  component: StatusDot,
  args: { label: 'Notifié', tone: 'blue' },
} satisfies Meta<typeof StatusDot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Notifie: Story = { name: 'Notifié' };

export const Tous: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusDot tone="red" label="À compléter" />
      <StatusDot tone="ink" label="À notifier" />
      <StatusDot tone="blue" label="Notifié" />
      <StatusDot tone="orange" label="En attente 3 j" />
      <StatusDot tone="green" label="Remis" />
    </div>
  ),
};
