import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusTimeline } from '#components/status-timeline';

const meta = {
  title: 'Composants/StatusTimeline',
  component: StatusTimeline,
  decorators: [(Story) => <div className="w-[353px] p-4"><Story /></div>],
} satisfies Meta<typeof StatusTimeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recu: Story = {
  name: 'Reçu',
  args: {
    steps: [
      { label: 'Reçu', state: 'current' },
      { label: 'Notifié', state: 'todo' },
      { label: 'Remis', state: 'todo' },
    ],
  },
};

export const Notifie: Story = {
  name: 'Notifié',
  args: {
    steps: [
      { label: 'Reçu', state: 'done' },
      { label: 'Notifié', state: 'current' },
      { label: 'Remis', state: 'todo' },
    ],
  },
};

export const Remis: Story = {
  args: {
    steps: [
      { label: 'Reçu', state: 'done' },
      { label: 'Notifié', state: 'done' },
      { label: 'Remis', state: 'current' },
    ],
  },
};
