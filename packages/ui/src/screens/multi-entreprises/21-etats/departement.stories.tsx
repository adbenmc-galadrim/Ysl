import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ColisChargementMobile,
  ColisErreurDesktop,
  ColisErreurMobile,
  ColisHorsLigneMobile,
  ColisVideDesktop,
  ColisVideMobile,
  ConfirmerHorsLigneMobile,
} from '#screens/multi-entreprises/21-etats/departement-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/21 États/Département',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ColisChargementTelephone: Story = {
  name: 'Colis, chargement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--departement-colis-chargement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ColisChargementMobile />,
};

export const ColisErreurTelephone: Story = {
  name: 'Colis, erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--departement-colis-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ColisErreurMobile />,
};

export const ColisErreurOrdinateur: Story = {
  name: 'Colis, erreur · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--departement-colis-erreur-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <ColisErreurDesktop />,
};

export const ColisHorsLigneTelephone: Story = {
  name: 'Colis, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--departement-colis-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ColisHorsLigneMobile />,
};

export const ColisVideTelephone: Story = {
  name: 'Colis, vide · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--departement-colis-vide-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ColisVideMobile />,
};

export const ColisVideOrdinateur: Story = {
  name: 'Colis, vide · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--departement-colis-vide-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <ColisVideDesktop />,
};

export const ConfirmerHorsLigneTelephone: Story = {
  name: 'Confirmer, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--departement-confirmer-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ConfirmerHorsLigneMobile />,
};
