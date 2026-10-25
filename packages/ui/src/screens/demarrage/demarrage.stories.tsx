import type { Meta, StoryObj } from '@storybook/react-vite';

import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { OFFLINE_PACKS } from '#fixtures/offline';
import { CameraPermissionScreen } from '#screens/demarrage/camera-permission-screen';
import { InstallScreen } from '#screens/demarrage/install-screen';
import { OfflinePrepScreen } from '#screens/demarrage/offline-prep-screen';
import { SignInScreen } from '#screens/demarrage/sign-in-screen';

/**
 * First launch, in order: install from Safari, sign in, download what the
 * offline mode needs, allow the camera.
 */
const meta = {
  title: 'Écrans/03 Démarrage/Démarrage',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

export const InstallerLApp: StoryObj<typeof InstallScreen> = {
  name: 'Installer l’app',
  parameters: { reference: '03-demarrage/demarrage--installer-l-app' },
  // Safari, before the app is installed: light whatever the theme.
  globals: { theme: 'clair' },
  render: (args) => <InstallScreen {...args} />,
};

export const Connexion: StoryObj<typeof SignInScreen> = {
  parameters: { reference: '03-demarrage/demarrage--connexion' },
  args: { email: 'karim.daoud@saint-laurent.fr', password: 'courrier-ysl' },
  render: (args) => <SignInScreen {...args} />,
};

export const PreparationHorsLigne: StoryObj<typeof OfflinePrepScreen> = {
  name: 'Préparation hors ligne',
  parameters: { reference: '03-demarrage/demarrage--preparation-hors-ligne' },
  args: {
    description:
      'L’app télécharge ce qu’il faut pour travailler sans réseau. Gardez le Wi-Fi le temps du téléchargement.',
    downloads: [
      { pack: OFFLINE_PACKS.directory, state: 'done', progress: 1 },
      {
        pack: OFFLINE_PACKS.labelReader,
        state: 'running',
        progress: 0.43,
        detail: '18 Mo sur 42 Mo',
      },
      { pack: OFFLINE_PACKS.assets, state: 'done', progress: 1 },
    ],
    notice: (
      <Banner
        tone="blue"
        size="lg"
        icon="info"
        title="Vous pourrez fermer l’app : le téléchargement reprendra à la prochaine ouverture."
        classNames={{
          root: 'pb-5',
          icon: 'text-blue',
          title: 'text-14 leading-[1.4] font-normal',
        }}
      />
    ),
    actions: [
      <Button key="continue" variant="inactive" block disabled>
        Continuer
      </Button>,
    ],
  },
  render: (args) => <OfflinePrepScreen {...args} />,
};

export const AutoriserLaCamera: StoryObj<typeof CameraPermissionScreen> = {
  name: 'Autoriser la caméra',
  parameters: { reference: '03-demarrage/demarrage--autoriser-la-camera' },
  render: (args) => <CameraPermissionScreen {...args} />,
};
