import type { Meta, StoryObj } from '@storybook/react-vite';

import { BarChart } from '#components/bar-chart';

const MONTH = [
  66, 93, 84, 105, 57, 81, 99, 123, 75, 90, 87, 72, 108, 114, 63, 78, 96, 84,
  90, 102, 81,
];

const meta = {
  title: 'Composants/BarChart',
  component: BarChart,
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: { values: MONTH, label: 'Colis reçus par jour, octobre 2026' },
} satisfies Meta<typeof BarChart>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mois: Story = {};

export const Semaine: Story = {
  args: { values: [84, 102, 90, 120, 66], label: 'Colis reçus par jour, cette semaine' },
};

/** The chart follows its container: here the width of a tablet column. */
export const Large: Story = {
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
};
