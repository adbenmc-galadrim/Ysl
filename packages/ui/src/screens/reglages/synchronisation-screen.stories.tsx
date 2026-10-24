import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SettingsGroup } from '#screens/reglages/settings-screen';
import { SynchronisationScreen } from '#screens/reglages/synchronisation-screen';

const meta = {
  title: 'Écrans/08 Réglages/Synchronisation',
  component: SynchronisationScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof SynchronisationScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Synchronisation: Story = {
  parameters: { reference: '08-reglages/reglages--synchronisation' },
  args: {
    state: 'synced',
    title: 'Tout est à jour',
    detail: 'Dernière synchronisation à 11 h 21',
    groups: [
      {
        header: 'Sur cet iPhone',
        footer:
          'Stockage protégé : iOS ne supprimera pas ces données, même si l’app n’est pas ouverte pendant longtemps.',
        items: [
          {
            icon: 'package',
            color: 'ink',
            label: 'Colis',
            value: '418',
            chevron: false,
          },
          {
            icon: 'image',
            color: 'indigo',
            label: 'Photos d’étiquettes',
            value: '22 Mo',
            chevron: false,
          },
          {
            icon: 'scan',
            color: 'indigo',
            label: 'Lecture des étiquettes',
            value: '42 Mo',
            chevron: false,
          },
          {
            icon: 'lock',
            color: 'green',
            label: 'Stockage protégé',
            value: 'Oui',
            chevron: false,
          },
        ],
      },
      {
        header: 'Mise à jour',
        items: [
          {
            icon: 'download',
            color: 'blue',
            label: 'Version 2.0.3',
            value: 'À jour',
            chevron: false,
          },
          {
            icon: 'refresh',
            color: 'grey',
            label: 'Rechercher une mise à jour',
          },
        ],
      },
    ],
  },
};

const WAITING_CHANGES: SettingsGroup = {
  header: 'Changements en attente · 3',
  footer:
    'L’export contient les données en attente, pas les photos. Partagez-le (Fichiers, AirDrop, e-mail) pour les garder si l’iPhone lâche.',
  items: [
    {
      key: 'op-1',
      icon: 'package',
      color: 'ink',
      label: 'Colis ···0622, Camille Morel',
      value: '10 h 42',
      chevron: false,
    },
    {
      key: 'op-2',
      icon: 'package',
      color: 'ink',
      label: 'Colis ···3338, Inès Garnier',
      value: '10 h 51',
      chevron: false,
    },
    {
      key: 'op-3',
      icon: 'user',
      color: 'indigo',
      label: 'Hugo Lefèvre',
      value: 'Refusé',
      chevron: false,
    },
    {
      key: 'export',
      icon: 'share',
      color: 'blue',
      label: 'Exporter les changements',
      chevron: false,
    },
  ],
};

/** Changes made offline, still on the phone, listed and exportable. */
export const EnAttente: Story = {
  name: 'En attente',
  args: {
    ...Synchronisation.args,
    state: 'pending',
    title: '3 changements à envoyer',
    detail: 'Hors ligne, envoi au retour du réseau',
    groups: [WAITING_CHANGES, ...Synchronisation.args.groups],
  },
};

/** A change has waited for more than a day: the phone is the only copy. */
export const Alerte: Story = {
  args: {
    ...Synchronisation.args,
    state: 'alert',
    title: '3 changements en attente depuis plus de 24 h',
    detail: 'Exportez-les par sécurité, puis synchronisez dès que possible.',
    groups: [WAITING_CHANGES, ...Synchronisation.args.groups],
  },
};
