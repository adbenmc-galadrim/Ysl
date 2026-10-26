import type { Meta, StoryObj } from '@storybook/react-vite';

import { ImportV1Screen } from '#screens/reglages/import-v1-screen';

const meta = {
  title: 'Écrans/08 Réglages/Historique v1',
  component: ImportV1Screen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ImportV1Screen>;

export default meta;

type Story = StoryObj<typeof meta>;

const READY = {
  state: 'ready',
  title: 'Importer l’historique de la v1',
  detail:
    'Le fichier CSV exporté par l’ancienne app. Chaque tracking est vérifié par la clé de son transporteur ; un import répété n’ajoute rien.',
  action: 'Choisir le fichier CSV',
} as const;

export const Pret: Story = { name: 'Prêt', args: READY };

export const EnCours: Story = {
  name: 'En cours',
  args: {
    state: 'importing',
    title: 'Import en cours…',
    detail: 'courrier-ysl-historique-2026-03-09.csv',
  },
};

export const Signale: Story = {
  name: 'Fait, trackings signalés',
  args: {
    state: 'flagged',
    title: '412 colis importés',
    detail: '5 lignes ignorées · 1 tracking signalé · 38 contacts créés',
    action: 'Importer un autre fichier',
    groups: [
      {
        header: 'Trackings signalés',
        footer:
          'Ces colis sont importés « À compléter » avec une note : vérifiez le numéro sur la fiche.',
        items: [
          {
            key: 'l3',
            icon: 'alert',
            color: 'orange',
            label: '7185713569',
            subtitle: 'Ligne 3 · clé fausse · Éloïse Martin',
            value: 'FedEx',
            chevron: false,
          },
        ],
      },
      {
        header: 'À compléter',
        items: [
          {
            key: 'l6',
            icon: 'edit',
            color: 'grey',
            label: '10464000209404',
            subtitle: 'Ligne 6 · statut « Perdu » inconnu',
            value: 'DPD',
            chevron: false,
          },
          {
            key: 'l12',
            icon: 'edit',
            color: 'grey',
            label: 'RR473124829GB',
            subtitle: 'Ligne 12 · sans destinataire',
            chevron: false,
          },
        ],
      },
      {
        header: 'Lignes ignorées',
        items: [
          {
            key: 'l7',
            label: 'Ligne 7',
            subtitle: '1ZE6344W0499230622 · en double dans le fichier',
            chevron: false,
          },
          {
            key: 'l9',
            label: 'Ligne 9',
            subtitle: 'RR473124829GB · date de réception illisible',
            chevron: false,
          },
          {
            key: 'l10',
            label: 'Ligne 10',
            subtitle: 'Sans tracking',
            chevron: false,
          },
          {
            key: 'l13',
            label: 'Ligne 13',
            subtitle: '986578788855 · déjà dans l’app',
            chevron: false,
          },
        ],
      },
    ],
  },
};

export const Fait: Story = {
  name: 'Fait, rien à revoir',
  args: {
    state: 'done',
    title: 'Aucun colis importé',
    detail: '412 lignes ignorées : déjà dans l’app',
    action: 'Importer un autre fichier',
  },
};

export const Echec: Story = {
  name: 'Échec',
  args: {
    ...READY,
    state: 'failed',
    title: 'Fichier refusé',
    detail:
      'Ce fichier n’est pas un export de la v1 : il lui manque les colonnes « tracking » et « destinataire ».',
    action: 'Choisir un autre fichier',
  },
};

export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: {
    state: 'offline',
    title: 'Hors ligne',
    detail: 'L’import passe par le serveur : reconnectez l’iPhone.',
  },
};
