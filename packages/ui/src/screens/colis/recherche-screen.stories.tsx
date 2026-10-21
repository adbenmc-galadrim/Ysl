import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { RechercheScreen } from '#screens/colis/recherche-screen';

const meta = {
  title: 'Écrans/05 Colis/Recherche',
  component: RechercheScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RechercheScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recherche: Story = {
  parameters: { reference: '05-colis/colis--recherche' },
  args: {
    query: 'garn',
    filters: [
      { label: 'Tout', selected: true },
      { label: 'En attente' },
      { label: 'Remis' },
      { label: '30 derniers jours' },
    ],
    sections: [
      {
        title: 'En attente',
        parcels: [{ ...PARCELS.ines, status: 'En attente depuis 3 jours' }],
      },
      {
        title: 'Remis',
        parcels: [PARCELS.inesFedex, PARCELS.inesAmazon, PARCELS.romain],
      },
    ],
    hint: 'Recherche sur le nom, le service, le numéro de suivi, l’expéditeur et le transporteur.',
  },
};
