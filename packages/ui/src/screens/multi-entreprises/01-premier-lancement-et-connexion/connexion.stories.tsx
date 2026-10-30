import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ConnexionDesktop,
  ConnexionMobile,
  LienExpireMobile,
  PremiereConnexionMobile,
} from '#screens/multi-entreprises/01-premier-lancement-et-connexion/connexion-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/01 Premier lancement/Tous les rôles',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const PAGE = 'multi-entreprises/01-premier-lancement-et-connexion';

export const ConnexionOrdinateur: Story = {
  name: 'Connexion · ordinateur',
  parameters: { reference: `${PAGE}/premier-lancement--tous-les-roles-connexion-ordinateur` },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <ConnexionDesktop />,
};

export const ConnexionTelephone: Story = {
  name: 'Connexion · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}/premier-lancement--tous-les-roles-connexion-mobile`,
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ConnexionMobile />,
};

export const LienExpire: Story = {
  name: 'Lien expiré · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}/premier-lancement--tous-les-roles-lien-expire-mobile`,
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <LienExpireMobile />,
};

export const PremiereConnexion: Story = {
  name: 'Première connexion, mot de passe à changer · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}/premier-lancement--tous-les-roles-premiere-connexion-mot-de-passe-a-changer-mobile`,
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <PremiereConnexionMobile />,
};
