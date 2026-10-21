import type { Meta, StoryObj } from '@storybook/react-vite';

import { HeroTile } from '#components/hero-tile';

const meta = {
  title: 'Composants/HeroTile',
  component: HeroTile,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HeroTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Permission: Story = { args: { icon: 'camera' } };

export const Refusee: Story = {
  args: { icon: 'camera', tone: 'red', size: 'lg', crossed: true },
};

export const MarqueDeLApp: Story = {
  args: { icon: 'package', tone: 'ink', size: 'md' },
};
