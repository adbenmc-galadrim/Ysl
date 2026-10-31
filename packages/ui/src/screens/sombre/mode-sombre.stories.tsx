import type { Meta, StoryObj } from '@storybook/react-vite';

import * as Colis from '#screens/colis/colis-screen.stories';
import { ColisScreen } from '#screens/colis/colis-screen';
import { CameraPermissionScreen } from '#screens/demarrage/camera-permission-screen';
import * as Demarrage from '#screens/demarrage/demarrage.stories';
import {
  OfflinePrepScreen,
  type OfflinePrepScreenProps,
} from '#screens/demarrage/offline-prep-screen';
import * as Reglages from '#screens/reglages/reglages-screen.stories';
import { ReglagesScreen } from '#screens/reglages/reglages-screen';
import * as Synchronisation from '#screens/reglages/synchronisation-screen.stories';
import { SynchronisationScreen } from '#screens/reglages/synchronisation-screen';

/**
 * The screens the app ships, in the dark. Penpot has no dark mockup: each
 * story reuses the light story's data, pins the theme, and is checked
 * against its own Storybook capture (`"source": "storybook"`), so a token
 * that drifts in the dark fails `pnpm visual` like a light one.
 */
const meta = {
  title: 'Écrans/11 Mode sombre',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: {
    viewport: { value: 'iphone15', isRotated: false },
    theme: 'sombre',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ColisAccueil: Story = {
  name: 'Colis',
  parameters: { reference: '11-sombre/sombre--colis' },
  render: () => <ColisScreen {...Colis.Accueil.args} />,
};

export const ReglagesAccueil: Story = {
  name: 'Réglages',
  parameters: { reference: '11-sombre/sombre--reglages' },
  render: () => <ReglagesScreen {...Reglages.Reglages.args} />,
};

export const SynchronisationAJour: Story = {
  name: 'Synchronisation',
  parameters: { reference: '11-sombre/sombre--synchronisation' },
  render: () => (
    <SynchronisationScreen {...Synchronisation.Synchronisation.args} />
  ),
};

export const PreparationHorsLigne: Story = {
  name: 'Préparation hors ligne',
  parameters: { reference: '11-sombre/sombre--preparation-hors-ligne' },
  render: () => (
    <OfflinePrepScreen
      {...(Demarrage.PreparationHorsLigne.args as OfflinePrepScreenProps)}
    />
  ),
};

export const AutoriserLaCamera: Story = {
  name: 'Autoriser la caméra',
  parameters: { reference: '11-sombre/sombre--autoriser-la-camera' },
  render: () => (
    <CameraPermissionScreen {...Demarrage.AutoriserLaCamera.args} />
  ),
};
