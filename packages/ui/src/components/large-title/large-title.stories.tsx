import type { Meta, StoryObj } from '@storybook/react-vite';

import { LargeTitle } from '#components/large-title';

const meta = {
  title: 'Composants/LargeTitle',
  component: LargeTitle,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof LargeTitle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Accueil: Story = {
  args: { title: 'Colis', subtitle: '18 colis, dont 6 à traiter' },
};

export const Fiche: Story = {
  args: { size: 'record', title: 'Camille Morel', subtitle: 'Studio, 2e étage' },
};

export const EcranPousse: Story = {
  name: 'Écran poussé',
  args: { size: 'md', title: '3 colis sélectionnés' },
};
