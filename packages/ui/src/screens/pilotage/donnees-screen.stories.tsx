import type { Meta, StoryObj } from '@storybook/react-vite';

import { DonneesScreen } from '#screens/pilotage/donnees-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Pilotage et courrier/Données et confidentialité',
  component: DonneesScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof DonneesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DonneesEtConfidentialite: Story = {
  name: 'Données et confidentialité',
  parameters: {
    reference: '09-zones-d-ombre/pilotage-et-courrier--donnees-et-confidentialite',
  },
  args: {
    retention: {
      header: 'Durées de conservation (validées par le DPO)',
      items: [
        { icon: 'image', color: 'indigo', label: 'Photos d’étiquettes', value: '90 jours' },
        { icon: 'package', color: 'ink', label: 'Colis remis', value: '12 mois' },
        { icon: 'sign', color: 'purple', label: 'Signatures', value: '12 mois' },
        { icon: 'mail', color: 'blue', label: 'Historique des e-mails', value: '6 mois' },
      ],
    },
    nextPurge: 'Le 1er novembre : 214 photos et 38 colis',
    note: 'Les photos restent sur l’iPhone et le serveur de l’entreprise. Aucune donnée n’est envoyée à un service tiers.',
  },
};
