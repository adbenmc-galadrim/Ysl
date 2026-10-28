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

const APP_PARCELS = [
  { id: 'p1', title: 'Zalando', detail: 'DPD ···4471' },
  { id: 'p2', title: 'Fnac', detail: 'Colissimo ···0918' },
  { id: 'p3', title: 'Recommandé', detail: 'La Poste ···2290' },
];

const SOON = [
  { icon: 'sign', label: 'Ajouter une signature', soon: 'bientôt' },
  { icon: 'camera', label: 'Ajouter une photo', soon: 'bientôt' },
] as const;

/**
 * As the app draws it until the signature and the undo arrive (YSL-75,
 * YSL-78): the parcels listed, another handover one tap away.
 */
export const DansLApp: Story = {
  name: 'Dans l’app',
  args: {
    title: '3 colis remis',
    description: 'à Nora Haddad, à 11 h 21',
    proofs: [
      { icon: 'hash', label: 'Code vérifié', done: true },
      ...SOON,
      { icon: 'cloud', label: 'Envoyée au serveur', done: true },
    ],
    parcels: APP_PARCELS,
    undoLabel: 'Annuler · bientôt',
    undoDisabled: true,
    onAnother: () => {},
  },
};

/** Chosen by name: nothing was checked, and the line says so. */
export const SansVerification: Story = {
  name: 'Sans vérification',
  args: {
    ...DansLApp.args,
    title: '1 colis remis',
    description: 'à Noé Bertin, à 9 h 05',
    proofs: [
      { icon: 'user', label: 'Sans vérification' },
      ...SOON,
      { icon: 'cloud', label: 'Envoyée au serveur', done: true },
    ],
    parcels: APP_PARCELS.slice(0, 1),
  },
};

/** Offline: the proof waits on the phone, the undo window is over. */
export const HorsLigne: Story = {
  name: 'Hors ligne',
  args: {
    ...DansLApp.args,
    offline: true,
    proofs: [
      { icon: 'qr', label: 'QR code vérifié', done: true },
      ...SOON,
      { icon: 'cloud', label: 'Sera synchronisée au retour du réseau' },
    ],
  },
};
