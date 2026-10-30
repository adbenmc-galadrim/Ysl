import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AdminRegulariserDesktop,
  AdminRegulariserMobile,
} from '#screens/multi-entreprises/09-depot-au-departement/admin-regulariser-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/09 Dépôt au département/Admin entreprise · Régulariser',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RegulariserOrdinateur: Story = {
  name: 'Régulariser · ordinateur',
  parameters: {
    reference:
      'multi-entreprises/09-depot-au-departement/depot--admin-entreprise-regulariser-un-colis-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <AdminRegulariserDesktop />,
};

export const RegulariserMobile: Story = {
  name: 'Régulariser · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--admin-entreprise-regulariser-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <AdminRegulariserMobile />,
};
