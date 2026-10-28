import type { Meta, StoryObj } from '@storybook/react-vite';

import { JournalRemisesScreen } from '#screens/remise/journal-remises-screen';
import { RemiseDetailScreen } from '#screens/remise/remise-detail-screen';

const meta = {
  title: 'Écrans/07 Remise/Journal des remises',
  component: JournalRemisesScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof JournalRemisesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No Penpot drawing: the « E-mails envoyés » log, for handovers (F43). */
export const Journal: Story = {
  args: {
    sections: [
      {
        title: 'Aujourd’hui',
        entries: [
          {
            id: 'h4',
            recipient: 'Nora Haddad',
            icon: 'hash',
            summary: '3 colis · Code vérifié',
            detail: '11 h 20 · Karim Benali',
            state: 'unsent',
            status: 'Pas encore envoyée au serveur',
          },
          {
            id: 'h3',
            recipient: 'Marc Petit',
            icon: 'qr',
            summary: '1 colis · QR code vérifié',
            detail: '9 h 05 · Lina Morel',
            state: 'done',
          },
        ],
      },
      {
        title: 'Hier',
        entries: [
          {
            id: 'h2',
            recipient: 'Noé Bertin',
            icon: 'user',
            summary: '2 colis · Sans vérification',
            detail: '17 h 40 · Karim Benali',
            state: 'cancelled',
            status: 'Annulée à 17 h 42',
          },
          {
            id: 'h1',
            recipient: 'Inès Garnier',
            icon: 'qr',
            summary: '1 colis · QR code vérifié, retiré par Lucas Martin',
            detail: '10 h 12 · Lina Morel',
            state: 'done',
          },
        ],
      },
    ],
  },
};

export const Recherche: Story = {
  args: {
    query: 'nora',
    sections: [
      {
        title: 'Aujourd’hui',
        entries: [Journal.args.sections[0]!.entries[0]!],
      },
    ],
  },
};

export const Vide: Story = {
  args: {
    query: 'zoé',
    sections: [],
    empty: {
      title: 'Aucune remise',
      description: 'Aucun nom ne correspond à « zoé ».',
    },
  },
};

export const Detail: StoryObj<typeof RemiseDetailScreen> = {
  name: 'Détail',
  render: (args) => <RemiseDetailScreen {...args} />,
  args: {
    title: '3 colis remis',
    subtitle: 'à Nora Haddad',
    items: [
      { label: 'Quand', value: 'Aujourd’hui à 11 h 20' },
      { label: 'Agent', value: 'Karim Benali' },
      { label: 'Méthode', value: 'Code vérifié' },
      { label: 'Synchronisation', value: 'Non envoyé' },
    ],
    parcels: [
      { id: 'p1', title: 'Zalando', detail: 'DPD ···4471' },
      { id: 'p2', title: 'Fnac', detail: 'Colissimo ···0918' },
      { id: 'p3', title: 'Recommandé', detail: 'La Poste ···2290' },
    ],
  },
};

export const DetailAnnulee: StoryObj<typeof RemiseDetailScreen> = {
  name: 'Détail annulée',
  render: (args) => <RemiseDetailScreen {...args} />,
  args: {
    ...Detail.args,
    title: '2 colis remis',
    subtitle: 'à Noé Bertin',
    cancelled: 'Remise annulée hier à 17 h 42',
    items: [
      { label: 'Quand', value: 'Hier à 17 h 40' },
      { label: 'Agent', value: 'Karim Benali' },
      { label: 'Méthode', value: 'Sans vérification' },
      { label: 'Synchronisation', value: 'À jour' },
    ],
    parcels: [],
  },
};
