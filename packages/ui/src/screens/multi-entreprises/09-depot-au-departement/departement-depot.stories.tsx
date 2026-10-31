import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DepartementColisParColisMobile,
  DepartementConfirmerDesktop,
  DepartementConfirmerEcartDesktop,
  DepartementConfirmerEcartMobile,
  DepartementConfirmerMobile,
  DepartementDepotConfirmeMobile,
  DepartementEmplacementMobile,
} from '#screens/multi-entreprises/09-depot-au-departement/departement-depot-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/09 Dépôt au département/Département · Dépôt',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ConfirmerOrdinateur: Story = {
  name: 'Confirmer · ordinateur',
  parameters: {
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-confirmer-le-depot-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <DepartementConfirmerDesktop />,
};

export const EcartOrdinateur: Story = {
  name: 'Écart · ordinateur',
  parameters: {
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-confirmer-le-depot-ecart-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <DepartementConfirmerEcartDesktop />,
};

export const ConfirmerMobile: Story = {
  name: 'Confirmer · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-confirmer-le-depot-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementConfirmerMobile />,
};

export const EcartMobile: Story = {
  name: 'Écart · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-confirmer-le-depot-ecart-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementConfirmerEcartMobile />,
};

export const ColisParColisMobile: Story = {
  name: 'Colis par colis · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-confirmer-colis-par-colis-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementColisParColisMobile />,
};

export const EmplacementMobile: Story = {
  name: 'Emplacement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-emplacement-du-lot-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementEmplacementMobile />,
};

export const ConfirmeMobile: Story = {
  name: 'Confirmé · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--departement-depot-confirme-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementDepotConfirmeMobile />,
};
