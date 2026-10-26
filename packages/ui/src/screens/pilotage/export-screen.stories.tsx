import type { Meta, StoryObj } from '@storybook/react-vite';

import { ExportScreen } from '#screens/pilotage/export-screen';

/** No Penpot frame: the mockup's reports are L3, only its CSV button ships. */
const meta = {
  title: 'Écrans/09 Zones d’ombre/Pilotage et courrier/Export',
  component: ExportScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    state: 'idle',
    fileName: 'courrier-historique-2026-10-26.csv',
    note: 'Tous les colis du service, remis compris, préparés par le serveur.',
  },
} satisfies Meta<typeof ExportScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pret: Story = { name: 'Prêt' };

export const EnCours: Story = {
  name: 'En cours',
  args: { state: 'running' },
};

export const FichierPret: Story = {
  name: 'Fichier prêt',
  args: {
    state: 'ready',
    note: 'Fichier prêt : touchez « Partager le fichier ».',
  },
};

export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: {
    state: 'offline',
    note: 'Hors ligne : l’export demande une connexion au serveur.',
  },
};

export const Echec: Story = {
  name: 'Échec',
  args: { state: 'failed', note: 'L’export n’a pas abouti. Réessayez.' },
};

export const Fait: Story = {
  args: { state: 'done', note: '612 colis exportés à 14:32.' },
};
