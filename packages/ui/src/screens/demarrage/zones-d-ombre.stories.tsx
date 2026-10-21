import type { Meta, StoryObj } from '@storybook/react-vite';

import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { OFFLINE_PACKS } from '#fixtures/offline';
import { CameraDeniedScreen } from '#screens/demarrage/camera-permission-screen';
import { OfflinePrepScreen } from '#screens/demarrage/offline-prep-screen';

/** First launch when it goes wrong: the Wi-Fi drops, the camera is refused. */
const meta = {
  title: 'Écrans/09 Zones d’ombre/Démarrage',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

export const TelechargementInterrompu: StoryObj<typeof OfflinePrepScreen> = {
  name: 'Téléchargement interrompu',
  parameters: {
    reference: '09-zones-d-ombre/demarrage--telechargement-interrompu',
  },
  args: {
    description:
      'Le téléchargement s’est arrêté : la connexion Wi-Fi a été perdue.',
    downloads: [
      { pack: OFFLINE_PACKS.directory, state: 'done', progress: 1 },
      {
        pack: OFFLINE_PACKS.labelReader,
        state: 'paused',
        progress: 0.43,
        detail: '18 Mo sur 42 Mo, en pause',
      },
      { pack: OFFLINE_PACKS.assets, state: 'done', progress: 1 },
    ],
    notice: (
      <Banner
        tone="blue"
        icon="info"
        title="Vous pouvez déjà commencer"
        description="Sans la lecture automatique, les colis se saisissent au clavier. Elle s’activera dès la fin du téléchargement."
        classNames={{ root: 'pb-5' }}
      />
    ),
    actions: [
      <Button key="mobile" variant="secondary" block>
        Utiliser les données mobiles (24 Mo)
      </Button>,
      <Button key="manual" block>
        Commencer en saisie manuelle
      </Button>,
    ],
  },
  render: (args) => <OfflinePrepScreen {...args} />,
};

export const CameraRefusee: StoryObj<typeof CameraDeniedScreen> = {
  name: 'Caméra refusée',
  parameters: { reference: '09-zones-d-ombre/demarrage--camera-refusee' },
  render: (args) => <CameraDeniedScreen {...args} />,
};
