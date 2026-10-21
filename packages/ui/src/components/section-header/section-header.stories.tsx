import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { SectionHeader } from '#components/section-header';

const meta = {
  title: 'Composants/SectionHeader',
  component: SectionHeader,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof SectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvecCompte: Story = {
  name: 'Avec compte',
  args: { title: 'En attente de retrait', count: 3 },
};

export const AvecAction: Story = {
  name: 'Avec action',
  args: {
    title: 'À notifier',
    count: 1,
    action: (
      <Button size="xs" className="w-[84px]">
        Notifier
      </Button>
    ),
  },
};
