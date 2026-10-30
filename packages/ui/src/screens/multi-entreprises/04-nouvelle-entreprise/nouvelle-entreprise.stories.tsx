import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  NouvelleEntrepriseAdministrateurDesktop,
  NouvelleEntrepriseFonctionnementDesktop,
  NouvelleEntrepriseModeleDesktop,
} from '#screens/multi-entreprises/04-nouvelle-entreprise/nouvelle-entreprise-desktop-screen';
import {
  NouvelleEntrepriseAdministrateurMobile,
  NouvelleEntrepriseCreeeMobile,
  NouvelleEntrepriseErreurAdresseMobile,
  NouvelleEntrepriseFonctionnementMobile,
  NouvelleEntrepriseModeleMobile,
} from '#screens/multi-entreprises/04-nouvelle-entreprise/nouvelle-entreprise-mobile-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/04 Nouvelle entreprise/Parcours',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };
const page =
  'multi-entreprises/04-nouvelle-entreprise/nouvelle-entreprise--admin-de-l-app-nouvelle-entreprise-';

export const ModeleOrdinateur: Story = {
  name: '1 Modèle · ordinateur',
  parameters: { reference: `${page}1-modele-ordinateur` },
  globals: desktop,
  render: () => <NouvelleEntrepriseModeleDesktop />,
};

export const ModeleMobile: Story = {
  name: '1 Modèle · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}1-modele-mobile` },
  globals: mobile,
  render: () => <NouvelleEntrepriseModeleMobile />,
};

export const FonctionnementOrdinateur: Story = {
  name: '2 Fonctionnement · ordinateur',
  parameters: { reference: `${page}2-fonctionnement-ordinateur` },
  globals: desktop,
  render: () => <NouvelleEntrepriseFonctionnementDesktop />,
};

export const FonctionnementMobile: Story = {
  name: '2 Fonctionnement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}2-fonctionnement-mobile`,
  },
  globals: mobile,
  render: () => <NouvelleEntrepriseFonctionnementMobile />,
};

export const AdministrateurOrdinateur: Story = {
  name: '3 Administrateur · ordinateur',
  parameters: { reference: `${page}3-administrateur-ordinateur` },
  globals: desktop,
  render: () => <NouvelleEntrepriseAdministrateurDesktop />,
};

export const AdministrateurMobile: Story = {
  name: '3 Administrateur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}3-administrateur-mobile`,
  },
  globals: mobile,
  render: () => <NouvelleEntrepriseAdministrateurMobile />,
};

export const ErreurAdresseMobile: Story = {
  name: 'Erreur d’adresse · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}erreur-d-adresse-mobile`,
  },
  globals: mobile,
  render: () => <NouvelleEntrepriseErreurAdresseMobile />,
};

export const CreeeMobile: Story = {
  name: 'Créée · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}creee-mobile` },
  globals: mobile,
  render: () => <NouvelleEntrepriseCreeeMobile />,
};
