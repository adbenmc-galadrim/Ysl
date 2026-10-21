import type { Meta, StoryObj } from '@storybook/react-vite';

import { ActionCard } from '#components/action-card';

const meta = {
  title: 'Composants/ActionCard',
  component: ActionCard,
  decorators: [
    (Story) => (
      <div className="w-[353px] bg-fill p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The state the screen is about: the sync. */
export const Etat: Story = {
  name: 'État (lg)',
  args: {
    size: 'lg',
    icon: 'check',
    tone: 'green',
    title: 'Tout est à jour',
    subtitle: 'Dernière synchronisation à 11 h 21',
    action: 'Synchroniser maintenant',
  },
};

/** A notice among other cards: the next purge. */
export const Avis: Story = {
  name: 'Avis (md)',
  args: {
    icon: 'trash',
    tone: 'neutral',
    title: 'Prochaine purge automatique',
    subtitle: 'Le 1er novembre : 214 photos et 38 colis',
    action: 'Exporter avant la purge',
  },
};

export const SansAction: Story = {
  name: 'Sans action',
  args: {
    icon: 'clock',
    tone: 'orange',
    title: '3 changements à envoyer',
    subtitle: 'Hors ligne depuis 10 h 58',
  },
};
