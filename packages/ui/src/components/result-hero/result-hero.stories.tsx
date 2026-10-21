import type { Meta, StoryObj } from '@storybook/react-vite';

import { ResultHero } from '#components/result-hero';

const meta = {
  title: 'Composants/ResultHero',
  component: ResultHero,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ResultHero>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Succes: Story = {
  args: { title: '3 colis remis', description: 'à Nora Haddad, à 11 h 21' },
};

export const Echec: Story = {
  args: {
    tone: 'red',
    icon: 'x',
    title: 'Remise annulée',
    description: 'Le colis repasse en attente de retrait',
  },
};
