import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';

const meta = {
  title: 'Composants/EmptyState',
  component: EmptyState,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ToutEstRemis: Story = {
  name: 'Tout est remis',
  args: {
    icon: 'inbox',
    title: 'Tout est remis',
    description:
      'Les colis scannés apparaîtront ici, rangés par ce qu’il reste à faire.',
    children: (
      <>
        <Button className="w-[201px]">Scanner des colis</Button>
        <Button variant="link" className="text-16 font-semibold">
          Voir les colis remis
        </Button>
      </>
    ),
  },
};

export const SansAction: Story = {
  name: 'Sans action',
  args: {
    icon: 'search',
    title: 'Aucun résultat',
    description: 'Essayez le nom de famille ou les quatre derniers caractères.',
  },
};
