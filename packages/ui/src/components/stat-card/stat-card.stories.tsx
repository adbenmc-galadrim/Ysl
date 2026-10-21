import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatCard } from '#components/stat-card';

const meta = {
  title: 'Composants/StatCard',
  component: StatCard,
  decorators: [
    (Story) => (
      <div className="w-[172px]">
        <Story />
      </div>
    ),
  ],
  args: { value: '612', label: 'colis reçus' },
} satisfies Meta<typeof StatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Chiffre: Story = {};

export const AlerteOrange: Story = {
  name: 'À traiter',
  args: { value: '9', label: 'en souffrance', tone: 'orange' },
};

/** Two columns, as on the Rapports screen. */
export const Grille: Story = {
  decorators: [
    (Story) => (
      <div className="grid w-[353px] grid-cols-2 gap-x-[9px] gap-y-3">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <>
      <StatCard value="612" label="colis reçus" />
      <StatCard value="587" label="remis" />
      <StatCard value="1,4 j" label="délai moyen de retrait" />
      <StatCard value="9" label="en souffrance" tone="orange" />
    </>
  ),
};
