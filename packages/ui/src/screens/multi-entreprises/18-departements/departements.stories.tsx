import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AfficheQrA4,
  DepartementsDesktop,
  DepartementsMobile,
  FicheDepartementDesktop,
  FicheDepartementMobile,
  HorairesDepartementMobile,
} from '#screens/multi-entreprises/18-departements/departements-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/18 Départements/Admin entreprise · Départements',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const phone = { viewport: { value: 'iphone15', isRotated: false } };
const REF = 'multi-entreprises/18-departements/departements--admin-entreprise';

export const ListeOrdinateur: Story = {
  name: 'Départements · ordinateur',
  parameters: { reference: `${REF}-departements-ordinateur` },
  globals: desktop,
  render: () => <DepartementsDesktop />,
};

export const FicheOrdinateur: Story = {
  name: 'Fiche · ordinateur',
  parameters: { reference: `${REF}-fiche-departement-ordinateur` },
  globals: desktop,
  render: () => <FicheDepartementDesktop />,
};

export const ListeTelephone: Story = {
  name: 'Départements · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-departements-mobile` },
  globals: phone,
  render: () => <DepartementsMobile />,
};

export const FicheTelephone: Story = {
  name: 'Fiche · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-fiche-departement-mobile` },
  globals: phone,
  render: () => <FicheDepartementMobile />,
};

export const HorairesTelephone: Story = {
  name: 'Horaires · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-horaires-du-departement-mobile` },
  globals: phone,
  render: () => <HorairesDepartementMobile />,
};

export const AfficheA4: Story = {
  name: 'Affiche QR · A4',
  parameters: { reference: `${REF}-affiche-qr-a4` },
  render: () => <AfficheQrA4 />,
};
