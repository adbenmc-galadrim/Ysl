import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScanRecommandeScreen } from '#screens/pilotage/scan-recommande-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Pilotage et courrier/Scan recommandé',
  component: ScanRecommandeScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ScanRecommandeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScanRecommande: Story = {
  name: 'Scan recommandé',
  parameters: {
    reference: '09-zones-d-ombre/pilotage-et-courrier--scan-recommande',
  },
  args: {
    count: 4,
    kind: 'Recommandé',
    label: {
      carrier: 'LA POSTE',
      recipient: 'Direction juridique',
      recipientHeading: 'DESTINATAIRE',
      address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
      trackingHeading: 'RECOMMANDÉ AVEC AR ',
      tracking: '1A 123 456 7890 1',
    },
    title: 'Lettre recommandée avec avis de réception',
    fields: [
      { label: 'N°', value: '1A 123 456 7890 1', mono: true },
      { label: 'Expéditeur', value: 'URSSAF Île-de-France' },
      { label: 'Pour', value: 'Direction juridique ?', status: 'warning' },
    ],
  },
};
