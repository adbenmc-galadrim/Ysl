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
    purge: { subtitle: 'Le 1er novembre : 214 photos et 38 colis' },
    note: 'Les photos restent sur l’iPhone et le serveur de l’entreprise. Aucune donnée n’est envoyée à un service tiers.',
  },
};

/** As the app mounts it: the durations of §9.2, the last run, purge and erase. */
export const DansLApp: Story = {
  name: 'Dans l’app',
  args: {
    retention: {
      header: 'Durées de conservation (validées par le DPO)',
      items: [
        {
          icon: 'image',
          color: 'indigo',
          label: 'Photos d’étiquettes',
          subtitle: 'Après la remise ou le retour du colis',
          value: '7 jours',
          chevron: false,
        },
        {
          icon: 'scan',
          color: 'sky',
          label: 'Lectures des étiquettes',
          subtitle: 'Texte lu et codes bruts',
          value: '30 jours',
          chevron: false,
        },
        {
          icon: 'package',
          color: 'ink',
          label: 'Colis remis',
          subtitle: 'Remis ou retournés, avec leur historique',
          value: '12 mois',
          chevron: false,
        },
        {
          icon: 'sign',
          color: 'purple',
          label: 'Signatures',
          value: '12 mois',
          chevron: false,
        },
        {
          icon: 'user',
          color: 'orange',
          label: 'Contacts hors annuaire',
          subtitle: 'Après leur dernier usage',
          value: '12 mois',
          chevron: false,
        },
      ],
    },
    purge: {
      title: 'Dernière purge',
      subtitle: 'Aujourd’hui à 3 h 00 : 38 colis et 4 contacts retirés',
      action: 'Purger maintenant',
    },
    note: 'Le serveur purge chaque jour ; cet iPhone purge ses photos et ses lectures à l’ouverture et après chaque synchronisation. Les photos restent sur l’iPhone. Aucune donnée n’est envoyée à un service tiers.',
    erase: {
      label: 'Effacer les données de cet iPhone',
      note: 'Vide la base locale et les photos, puis revient à la connexion.',
    },
  },
};

/** Offline: the purge waits for the network, the last run read from before. */
export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: {
    ...DansLApp.args,
    purge: {
      title: 'Dernière purge',
      subtitle:
        'Hors ligne : la dernière purge s’affiche avec le réseau',
      action: 'Purger maintenant',
      disabled: true,
    },
  },
};
