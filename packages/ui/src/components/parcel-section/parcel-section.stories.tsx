import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { ParcelSection } from '#components/parcel-section';
import { PARCELS } from '#fixtures/parcels';

const meta = {
  title: 'Composants/ParcelSection',
  component: ParcelSection,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
  args: {
    title: 'En attente de retrait',
    parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
  },
} satisfies Meta<typeof ParcelSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = { name: 'Défaut' };

export const AvecAction: Story = {
  name: 'Avec action',
  args: {
    title: 'À notifier',
    parcels: [PARCELS.camille],
    action: (
      <Button size="xs" className="w-[84px]">
        Notifier
      </Button>
    ),
  },
};

export const Selection: Story = {
  name: 'Sélection',
  args: { selectedIds: [PARCELS.ines.id, PARCELS.nora.id] },
};
