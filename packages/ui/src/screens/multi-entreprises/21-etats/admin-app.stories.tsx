import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  EntreprisesChargementMobile,
  EntreprisesErreurMobile,
  EntreprisesVideMobile,
} from '#screens/multi-entreprises/21-etats/admin-app-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/21 États/Admin de l’app',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ChargementTelephone: Story = {
  name: 'Chargement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-de-l-app-entreprises-chargement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <EntreprisesChargementMobile />,
};

export const ErreurTelephone: Story = {
  name: 'Erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-de-l-app-entreprises-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <EntreprisesErreurMobile />,
};

export const VideTelephone: Story = {
  name: 'Vide · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-de-l-app-entreprises-vide-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <EntreprisesVideMobile />,
};
