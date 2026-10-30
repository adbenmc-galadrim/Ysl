import type { Meta, StoryObj } from '@storybook/react-vite';

import { DetailsList } from '#components/details-list';

const meta = {
  title: 'Composants/DetailsList',
  component: DetailsList,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof DetailsList>;

export default meta;

type Story = StoryObj<typeof DetailsList>;

export const Details: Story = {
  name: 'Détails d’un colis',
  args: {
    title: 'Détails',
    items: [
      { label: 'Expéditeur', value: 'Metalworks SpA' },
      { label: 'Nombre de colis', value: 1 },
      { label: 'Emplacement', value: 'Étagère B' },
      { label: 'Note', value: 'Aucune' },
    ],
  },
};

export const SansTitre: Story = {
  name: 'Sans titre',
  args: {
    items: [
      { label: 'Transporteur', value: 'UPS' },
      { label: 'Reçu', value: 'Aujourd’hui à 10 h 42' },
    ],
  },
};
