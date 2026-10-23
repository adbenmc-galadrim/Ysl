import type { Meta, StoryObj } from '@storybook/react-vite';

import { CheckDisc } from '#components/check-disc';

const meta = {
  title: 'Composants/CheckDisc',
  component: CheckDisc,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CheckDisc>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CarteDeLecture: Story = {
  name: 'Carte de lecture',
  args: { size: 36, d: 'M10,18L16,24L27,12', stroke: 2.8 },
};

export const Photo: Story = {
  args: { size: 14, d: 'M3.5,7L6,9.5L10.5,4.5', stroke: 1.6 },
};
