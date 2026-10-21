import type { Meta, StoryObj } from '@storybook/react-vite';

import { RemiseConfirmeeScreen } from '#screens/remise/remise-confirmee-screen';

const meta = {
  title: 'Écrans/07 Remise/Remise confirmée',
  component: RemiseConfirmeeScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RemiseConfirmeeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Confirmee: Story = {
  name: 'Confirmée',
  parameters: { reference: '07-remise/remise--remise-confirmee' },
  args: {
    title: '3 colis remis',
    description: 'à Nora Haddad, à 11 h 21',
    proofs: [
      { icon: 'qr', label: 'QR code vérifié', done: true },
      { icon: 'sign', label: 'Signature enregistrée', done: true },
      { icon: 'cloud', label: 'Envoyé au serveur', done: true },
    ],
  },
};

/** Offline: the proof waits on the phone, the undo window is over. */
export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: {
    ...Confirmee.args,
    undoable: false,
    proofs: [
      { icon: 'qr', label: 'QR code vérifié', done: true },
      { icon: 'sign', label: 'Signature enregistrée', done: true },
      { icon: 'cloud', label: 'Envoi dès le retour du réseau' },
    ],
  },
};
