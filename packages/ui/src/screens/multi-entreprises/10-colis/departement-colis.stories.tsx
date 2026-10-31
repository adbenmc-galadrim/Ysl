import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  FicheColisMobile,
  HistoriqueDesktop,
  HistoriqueMobile,
  RechercheMobile,
  SelectionMobile,
} from '#screens/multi-entreprises/10-colis/departement-colis-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/10 Colis/Département',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'iphone15', isRotated: false } };

export const HistoriqueOrdinateur: Story = {
  name: 'Historique · ordinateur',
  parameters: {
    reference: 'multi-entreprises/10-colis/colis--departement-colis-historique-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <HistoriqueDesktop />,
};

export const Historique: Story = {
  name: 'Historique · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-colis-historique-mobile',
  },
  globals: phone,
  render: () => <HistoriqueMobile />,
};

export const Fiche: Story = {
  name: 'Fiche colis · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-fiche-colis-mobile',
  },
  globals: phone,
  render: () => <FicheColisMobile />,
};

export const Recherche: Story = {
  name: 'Recherche · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-recherche-mobile',
  },
  globals: phone,
  render: () => <RechercheMobile />,
};

export const Selection: Story = {
  name: 'Sélection · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-selection-mobile',
  },
  globals: phone,
  render: () => <SelectionMobile />,
};
