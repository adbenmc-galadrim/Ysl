import type { Meta, StoryObj } from '@storybook/react-vite';

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
          { icon: 'package', color: 'ink', label: 'Colis', value: '418', chevron: false },
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
          { icon: 'refresh', color: 'grey', label: 'Rechercher une mise à jour' },
        ],
      },
    ],
  },
};

/** Changes made offline, still on the phone. */
export const EnAttente: Story = {
  name: 'En attente',
  args: {
    ...Synchronisation.args,
    state: 'pending',
    title: '3 changements à envoyer',
    detail: 'Hors ligne depuis 10 h 58',
  },
};
