import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { AnnulerRemiseScreen } from '#screens/remise/annuler-remise-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Remise/Annuler une remise',
  component: AnnulerRemiseScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof AnnulerRemiseScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MotifChoisi: Story = {
  name: 'Motif choisi',
  parameters: { reference: '09-zones-d-ombre/remise--annuler-une-remise' },
  args: {
    parcel: PARCELS.malik,
    handedOver: 'Remis hier à 9 h 12',
    proof: 'À Malik Benali, QR code vérifié, par Karim',
    reason: 'Mauvais colis',
    note: 'Le colis remis était celui de M. Bernard',
  },
};

/** Before a reason is picked, the red button stays off. */
export const SansMotif: Story = {
  name: 'Sans motif',
  args: { ...MotifChoisi.args, reason: undefined, note: '' },
};
