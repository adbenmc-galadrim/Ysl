import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconButton } from '#components/icon-button';

const meta = {
  title: 'Composants/IconButton',
  component: IconButton,
  args: { icon: 'menu', label: 'Menu' },
} satisfies Meta<typeof IconButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Gris: Story = {};

export const Retour: Story = {
  args: { icon: 'back', label: 'Retour', size: 'lg', iconSize: 22 },
};

export const Nuit: Story = {
  args: { icon: 'x', label: 'Fermer', variant: 'night' },
  parameters: { backgrounds: { default: 'dark' } },
};

export const Transparent: Story = {
  args: { icon: 'more', label: 'Plus', variant: 'ghost' },
};
