import type { Meta, StoryObj } from '@storybook/react-vite';

import { Banner } from '#components/banner';

const meta = {
  title: 'Composants/Banner',
  component: Banner,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HorsLigne: Story = {
  name: 'Orange, changements en attente',
  args: {
    tone: 'orange',
    icon: 'cloud',
    title: '4 changements en attente',
    description: 'Enregistrés sur l’iPhone, envoyés au retour du réseau.',
  },
};

export const EnRetard: Story = {
  name: 'Rouge, en retard',
  args: {
    tone: 'red',
    icon: 'clock',
    title: 'En attente depuis 8 jours',
    description: 'Deux relances sans réponse.',
  },
};

export const Information: Story = {
  name: 'Bleu, à savoir',
  args: {
    tone: 'blue',
    icon: 'info',
    title: 'Étiquette retour à demander à FedEx',
    description: 'Le colis passe en « Retour en cours » jusqu’à l’enlèvement.',
  },
};

export const EtatDuColis: Story = {
  name: 'Gris, état d’un colis',
  args: {
    tone: 'grey',
    size: 'lg',
    icon: 'package',
    title: 'Reçu à 10 h 42, pas encore notifiée',
    description: 'Partira avec l’e-mail groupé du lot',
  },
};
