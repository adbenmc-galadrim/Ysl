import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  TourneeErreurMobile,
  TourneeHorsLigneMobile,
  TourneePremiereFoisMobile,
  TourneeTermineeMobile,
} from '#screens/multi-entreprises/21-etats/navette-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/21 États/Navette',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const TourneeErreurTelephone: Story = {
  name: 'Tournée, erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--navette-tournee-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <TourneeErreurMobile />,
};

export const TourneeHorsLigneTelephone: Story = {
  name: 'Tournée, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--navette-tournee-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <TourneeHorsLigneMobile />,
};

export const TourneePremiereFoisTelephone: Story = {
  name: 'Tournée, première fois · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--navette-tournee-premiere-fois-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <TourneePremiereFoisMobile />,
};

export const TourneeTermineeTelephone: Story = {
  name: 'Tournée, terminée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--navette-tournee-terminee-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <TourneeTermineeMobile />,
};
