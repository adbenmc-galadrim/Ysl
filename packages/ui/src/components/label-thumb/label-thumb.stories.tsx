import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelThumb } from '#components/label-thumb';

const meta = {
  title: 'Composants/LabelThumb',
  component: LabelThumb,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LabelThumb>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Liste: Story = {};

export const Grand: Story = { args: { size: 96 } };
