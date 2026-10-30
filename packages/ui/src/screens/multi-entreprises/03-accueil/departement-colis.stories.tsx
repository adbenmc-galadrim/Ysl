import type { Meta, StoryObj } from '@storybook/react-vite';

import { STUDIO_PARCELS } from '#fixtures/multi-entreprises';
import {
  DepartementColisDesktop,
  DepartementColisMobile,
} from '#screens/multi-entreprises/03-accueil/departement-colis-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/03 Accueil/Département · Colis',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PresentsOrdinateur: Story = {
  name: 'Présents · ordinateur',
  parameters: {
    reference:
      'multi-entreprises/03-accueil/accueil--departement-colis-presents-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <DepartementColisDesktop parcels={STUDIO_PARCELS} activeParcel="camille" />
  ),
};

export const DepartementMobile: Story = {
  name: 'Département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/03-accueil/accueil--departement-colis-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementColisMobile />,
};
