import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CameraControls,
  CameraTool,
  CameraTopBar,
  ShutterButton,
} from '#components/camera-controls';

const meta = {
  title: 'Composants/CameraControls',
  component: CameraControls,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-[393px] bg-scene-floor py-6">
        <Story />
      </div>
    ),
  ],
  args: { count: 12 },
} satisfies Meta<typeof CameraControls>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The bottom of the burst scan: list, shutter, Terminer, and the tools. */
export const AvecOutils: Story = {
  name: 'Avec outils',
  args: {
    tools: {
      start: <CameraTool icon="image" label="Importer une photo" />,
      end: <CameraTool icon="keyboard" label="Saisir le numéro" />,
    },
  },
};

export const SansOutils: Story = { name: 'Sans outils' };

/** A single scan (a QR code at the desk) has no batch to count. */
export const SansCompteur: Story = {
  name: 'Sans compteur',
  args: { count: undefined, doneLabel: 'Annuler' },
};

export const BarreDuHaut: Story = {
  name: 'Barre du haut',
  render: () => (
    <div className="flex flex-col gap-4">
      <CameraTopBar title="Lot : 12 colis" />
      <CameraTopBar title="QR code du retrait" torch={false} />
    </div>
  ),
};

export const Declencheur: Story = {
  name: 'Déclencheur',
  render: () => (
    <div className="flex justify-center">
      <ShutterButton />
    </div>
  ),
};
