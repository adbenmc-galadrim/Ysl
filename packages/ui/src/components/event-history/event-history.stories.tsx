import type { Meta, StoryObj } from '@storybook/react-vite';

import { EventHistory } from '#components/event-history';

const meta = {
  title: 'Composants/EventHistory',
  component: EventHistory,
  decorators: [
    (Story) => (
      <div className="w-[350px] p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventHistory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  name: 'Par défaut',
  args: {
    entries: [
      {
        id: 'e6',
        title: 'Modification refusée par le serveur',
        detail: 'Données invalides, à corriger sur l’appareil.',
        tone: 'red',
      },
      { id: 'e5', title: 'Notification annulée', detail: 'Hier à 16 h 20' },
      { id: 'e4', title: 'Notifié', detail: 'Hier à 14 h 02' },
      { id: 'e3', title: 'Modifié : destinataire', detail: 'Hier à 14 h 01' },
      { id: 'e2', title: 'Modifié : poids', detail: 'Hier à 11 h 40' },
      { id: 'e1', title: 'Reçu', detail: 'Hier à 10 h 42' },
    ],
  },
};
