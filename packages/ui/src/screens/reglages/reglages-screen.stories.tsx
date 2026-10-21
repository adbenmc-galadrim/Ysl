import type { Meta, StoryObj } from '@storybook/react-vite';

import { AGENTS } from '#fixtures/people';
import { ReglagesScreen } from '#screens/reglages/reglages-screen';

const meta = {
  title: 'Écrans/08 Réglages/Réglages',
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

export const Reglages: Story = {
  name: 'Réglages',
  parameters: { reference: '08-reglages/reglages--reglages' },
  args: {
    account: {
      name: AGENTS.karim.name,
      initials: AGENTS.karim.initials,
      description: 'Agent courrier, administrateur',
    },
    groups: [
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
        ],
      },
      {
        header: 'App',
        items: [
          { icon: 'volume', color: 'grey', label: 'Son au scan', toggle: true },
          { icon: 'sun', color: 'grey', label: 'Apparence', value: 'Automatique' },
          {
            icon: 'info',
            color: 'grey',
            label: 'Version 2.0.3',
            value: 'À jour',
            chevron: false,
          },
        ],
      },
    ],
  },
};
