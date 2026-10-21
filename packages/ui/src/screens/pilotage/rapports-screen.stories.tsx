import type { Meta, StoryObj } from '@storybook/react-vite';

import { RapportsScreen } from '#screens/pilotage/rapports-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Pilotage et courrier/Rapports et export',
  component: RapportsScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RapportsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RapportsEtExport: Story = {
  name: 'Rapports et export',
  parameters: {
    reference: '09-zones-d-ombre/pilotage-et-courrier--rapports-et-export',
  },
  args: {
    period: 'Mois',
    periodLabel: 'Octobre 2026',
    stats: [
      { value: '612', label: 'colis reçus' },
      { value: '587', label: 'remis' },
      { value: '1,4 j', label: 'délai moyen de retrait' },
      { value: '9', label: 'en souffrance', tone: 'orange' },
    ],
    perDay: [
      66, 93, 84, 105, 57, 81, 99, 123, 75, 90, 87, 72, 108, 114, 63, 78, 96,
      84, 90, 102, 81,
    ],
    carriers:
      'Transporteurs : UPS 31 %, DHL 22 %, Colissimo 18 %, FedEx 12 %, autres 17 %',
  },
};
