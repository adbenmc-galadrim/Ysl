import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ColisTouchesDesktop,
  ColisTouchesMobile,
  FonctionnementEnregistreDesktop,
  FonctionnementEnregistreMobile,
  FonctionnementMobile,
  FonctionnementModificationsDesktop,
} from '#screens/multi-entreprises/17-fonctionnement/fonctionnement-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/17 Fonctionnement/Admin entreprise · Fonctionnement',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const phone = { viewport: { value: 'iphone15', isRotated: false } };
const REF =
  'multi-entreprises/17-fonctionnement/fonctionnement--admin-entreprise-fonctionnement';

export const ModificationsOrdinateur: Story = {
  name: 'Modifications en cours · ordinateur',
  parameters: { reference: `${REF}-modifications-en-cours-ordinateur` },
  globals: desktop,
  render: () => <FonctionnementModificationsDesktop />,
};

export const ColisTouchesOrdinateur: Story = {
  name: 'Colis touchés · ordinateur',
  parameters: { reference: `${REF}-colis-touches-ordinateur` },
  globals: desktop,
  render: () => <ColisTouchesDesktop />,
};

export const EnregistreOrdinateur: Story = {
  name: 'Enregistré · ordinateur',
  parameters: { reference: `${REF}-enregistre-ordinateur` },
  globals: desktop,
  render: () => <FonctionnementEnregistreDesktop />,
};

export const FonctionnementTelephone: Story = {
  name: 'Fonctionnement · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-mobile` },
  globals: phone,
  render: () => <FonctionnementMobile />,
};

export const ColisTouchesTelephone: Story = {
  name: 'Colis touchés · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-colis-touches-mobile` },
  globals: phone,
  render: () => <ColisTouchesMobile />,
};

export const EnregistreTelephone: Story = {
  name: 'Enregistré · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-enregistre-mobile` },
  globals: phone,
  render: () => <FonctionnementEnregistreMobile />,
};
