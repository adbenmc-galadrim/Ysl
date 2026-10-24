import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { SCANNED_LABEL } from '#fixtures/reception';
import { PlusieursPiecesScreen } from '#screens/reception-zones/plusieurs-pieces-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Réception/Colis en plusieurs pièces',
  component: PlusieursPiecesScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    count: 12,
    label: SCANNED_LABEL,
    parcel: {
      recipient: PARCELS.camille.recipient,
      meta: `${PARCELS.camille.carrier} ···${PARCELS.camille.last4}`,
    },
  },
} satisfies Meta<typeof PlusieursPiecesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ColisEnPlusieursPieces: Story = {
  name: 'Colis en plusieurs pièces',
  parameters: {
    reference: '09-zones-d-ombre/reception--colis-en-plusieurs-pieces',
  },
  args: { pieces: { total: 3, read: [1, 2] } },
};

/** The 2nd box never came: the gap is named by its number, not counted. */
export const PieceManquante: Story = {
  name: 'Pièce manquante au milieu',
  args: { pieces: { total: 3, read: [1, 3] } },
};

/** Every piece read: nothing left to decide. */
export const ToutesLesPieces: Story = {
  name: 'Toutes les pièces lues',
  args: { pieces: { total: 3, read: [1, 2, 3] } },
};
