import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrowserWindow } from '#device';
import { DESK_PARCELS } from '#fixtures/desk';
import { PosteOrdinateurScreen } from '#screens/pilotage/poste-ordinateur-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Plusieurs agents et ordinateur/Poste ordinateur',
  component: PosteOrdinateurScreen,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  decorators: [
    (Story) => (
      <BrowserWindow url="courrier.saintlaurent.fr">
        <Story />
      </BrowserWindow>
    ),
  ],
} satisfies Meta<typeof PosteOrdinateurScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PosteOrdinateur: Story = {
  name: 'Poste ordinateur',
  parameters: {
    reference: '09-zones-d-ombre/plusieurs-agents-et-ordinateur--poste-ordinateur',
  },
  args: {
    parcels: DESK_PARCELS,
    activeFilter: 'all',
    filters: [
      { id: 'all', label: 'Tous', count: 18 },
      { id: 'incomplete', label: 'À compléter', count: 1 },
      { id: 'toNotify', label: 'À notifier', count: 1 },
      { id: 'waiting', label: 'En attente', count: 14 },
      { id: 'late', label: 'En souffrance', count: 2 },
    ],
  },
};
