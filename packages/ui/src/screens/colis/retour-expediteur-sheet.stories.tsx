import type { Meta, StoryObj } from '@storybook/react-vite';

import { RetourExpediteurSheet } from '#screens/colis/retour-expediteur-sheet';

const meta: Meta<typeof RetourExpediteurSheet> = {
  title: 'Écrans/05 Colis/Retour à l’expéditeur',
  component: RetourExpediteurSheet,
};

export default meta;
type Story = StoryObj<typeof RetourExpediteurSheet>;

const reasons = [
  { id: 'unclaimed', label: 'Non réclamé' },
  { id: 'refused', label: 'Refusé' },
  { id: 'left', label: 'Destinataire parti' },
  { id: 'address', label: 'Erreur d’adresse' },
];

export const AvecNavette: Story = {
  name: 'Avec navette',
  args: {
    waiting: {
      title: 'En attente depuis 8 jours',
      description: 'Deux relances sans réponse.',
    },
    reasons,
    reason: 'unclaimed',
    sender: 'Zalando SE, Berlin',
    next: {
      title: 'La navette reprend le colis',
      description:
        'Il passe en « Retour en cours » jusqu’à son passage. Son code de retrait se ferme.',
    },
    confirmLabel: 'Préparer le retour',
    onConfirm: () => {},
    onDismiss: () => {},
  },
};

export const SansNavette: Story = {
  name: 'Sans navette',
  args: {
    reasons,
    reason: 'refused',
    sender: 'Metalworks SpA',
    next: {
      title: 'Le colis quitte la liste',
      description: 'Il part chez l’expéditeur. Son code de retrait se ferme.',
    },
    confirmLabel: 'Retourner le colis',
    onConfirm: () => {},
    onDismiss: () => {},
  },
};
