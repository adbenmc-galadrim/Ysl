import type { Meta, StoryObj } from '@storybook/react-vite';

import { DIRECTORY, DIRECTORY_LETTERS } from '#fixtures/directory';
import { AnnuaireScreen } from '#screens/reglages/annuaire-screen';

const meta = {
  title: 'Écrans/08 Réglages/Annuaire',
  component: AnnuaireScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof AnnuaireScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Annuaire: Story = {
  parameters: { reference: '08-reglages/reglages--annuaire' },
  args: {
    people: DIRECTORY,
    letters: DIRECTORY_LETTERS,
    importTitle: 'Import du 18 octobre : 312 personnes',
    importDetail: 'Fichier CSV de la DSI, gardé sur l’iPhone.',
  },
};
