import type { Meta, StoryObj } from '@storybook/react-vite';

import { ReglagesScreen } from '#screens/reglages/reglages-screen';

/**
 * The same Réglages screen once the steering features exist: a "Pilotage"
 * group on top, and the account card moved out to the team screen.
 */
const meta = {
  title: 'Écrans/09 Zones d’ombre/Pilotage et courrier/Réglages, nouvelles entrées',
  component: ReglagesScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ReglagesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NouvellesEntrees: Story = {
  name: 'Réglages, nouvelles entrées',
  parameters: {
    reference: '09-zones-d-ombre/pilotage-et-courrier--reglages-nouvelles-entrees',
  },
  args: {
    groups: [
      {
        header: 'Pilotage (nouveau)',
        items: [
          { icon: 'list', color: 'sky', label: 'Rapports et export' },
          { icon: 'users', color: 'violet', label: 'Équipe et postes', value: '3 agents' },
          { icon: 'lock', color: 'green', label: 'Données et confidentialité' },
        ],
      },
      {
        header: 'Données',
        items: [
          { icon: 'cloud', color: 'green', label: 'Synchronisation', value: 'À jour' },
          { icon: 'send', color: 'blue', label: 'E-mails envoyés', value: '1 échec' },
          { icon: 'download', color: 'indigo', label: 'Hors ligne', value: '58 Mo' },
        ],
      },
      {
        header: 'Service courrier',
        items: [
          { icon: 'users', color: 'orange', label: 'Annuaire', value: '312' },
          { icon: 'pin', color: 'red', label: 'Lieu et horaires de retrait' },
          {
            icon: 'bell',
            color: 'purple',
            label: 'Relances automatiques',
            value: 'J+2, J+5',
          },
          { icon: 'inbox', color: 'grey', label: 'Types de courrier', value: '3' },
        ],
      },
    ],
  },
};
