import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { SelectionScreen } from '#screens/colis/selection-screen';

const meta = {
  title: 'Écrans/05 Colis/Sélection',
  component: SelectionScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof SelectionScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selection: Story = {
  name: 'Sélection',
  parameters: { reference: '05-colis/colis--selection' },
  args: {
    sections: [
      { title: 'À notifier', parcels: [PARCELS.camille] },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
    ],
    selectedIds: [PARCELS.ines.id, PARCELS.hugo.id, PARCELS.nora.id],
  },
};
