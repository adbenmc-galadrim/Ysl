import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusPill, SYNC_PILL } from '#components/status-pill';

const meta = {
  title: 'Composants/StatusPill',
  component: StatusPill,
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AJour: Story = { name: 'À jour', args: SYNC_PILL.synced };

export const Synchronisation: Story = { args: SYNC_PILL.syncing };

export const HorsLigne: Story = { name: 'Hors ligne', args: SYNC_PILL.offline };
