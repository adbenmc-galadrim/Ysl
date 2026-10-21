import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { FicheColisScreen } from '#screens/colis/fiche-colis-screen';

const meta = {
  title: 'Écrans/05 Colis/Fiche colis',
  component: FicheColisScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof FicheColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const camille = PARCELS.camille;

export const ANotifier: Story = {
  name: 'À notifier',
  parameters: { reference: '05-colis/colis--fiche-colis-a-notifier' },
  args: {
    recipient: camille.recipient,
    place: camille.place,
    tracking: camille.tracking,
    carrier: camille.carrier,
    state: {
      icon: 'package',
      title: 'Reçu à 10 h 42, pas encore notifiée',
      description: 'Partira avec l’e-mail groupé du lot',
    },
    steps: [
      { label: 'Reçu', state: 'current' },
      { label: 'Notifié', state: 'todo' },
      { label: 'Remis', state: 'todo' },
    ],
    details: [
      { label: 'Expéditeur', value: camille.sender },
      { label: 'Nombre de colis', value: camille.pieces },
      { label: 'Emplacement', value: camille.shelf },
      { label: 'Note', value: 'Aucune' },
    ],
    primaryAction: 'Notifier maintenant',
  },
};
