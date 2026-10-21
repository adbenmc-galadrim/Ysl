import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CameraNotice,
  CameraNoticeButton,
  CameraPanel,
  LastScanPanel,
} from '#components/camera-panel';
import { ScanFields } from '#components/scan-fields';

const meta = {
  title: 'Composants/CameraPanel',
  component: CameraNotice,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex w-[393px] flex-col bg-scene px-4 py-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CameraNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DernierAjoute: Story = {
  name: 'Dernier ajouté',
  render: () => (
    <LastScanPanel
      title="Hugo Lefèvre"
      meta="DHL ···7112"
      action={{ icon: 'undo', label: 'Annuler' }}
    />
  ),
};

export const Lecture: Story = {
  render: () => (
    <CameraPanel className="px-4 pt-[17px] pb-[18px]">
      <ScanFields
        fields={[
          { label: 'Transporteur', value: 'UPS' },
          { label: 'Suivi', value: '1Z E63 44W 04 9923 0622', mono: true },
          { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
        ]}
      />
    </CameraPanel>
  ),
};

export const Avertissement: Story = {
  args: {
    tone: 'warning',
    icon: 'alert',
    title: 'Déjà dans ce lot',
    children: 'Camille Morel, UPS ···0622, scanné à 10 h 42',
  },
};

export const Choix: Story = {
  args: {
    children: 'Ce colis n’a pas été ajouté une deuxième fois.',
    actions: (
      <>
        <CameraNoticeButton>Voir le colis</CameraNoticeButton>
        <CameraNoticeButton>Ajouter quand même</CameraNoticeButton>
      </>
    ),
  },
};

export const Erreur: Story = {
  args: {
    tone: 'danger',
    icon: 'alert',
    title: 'Numéro de suivi introuvable',
    children: 'Reflet sur l’étiquette. Inclinez légèrement le colis.',
    actions: (
      <>
        <CameraNoticeButton>Saisir le numéro</CameraNoticeButton>
        <CameraNoticeButton>Garder la photo</CameraNoticeButton>
      </>
    ),
  },
};
