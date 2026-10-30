import type { Meta, StoryObj } from '@storybook/react-vite';

import { AdminColisDesktop } from '#screens/multi-entreprises/10-colis/admin-colis-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/10 Colis/Admin entreprise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ordinateur: Story = {
  name: 'Colis · ordinateur',
  parameters: {
    reference: 'multi-entreprises/10-colis/colis--admin-entreprise-colis-ordinateur-v2-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <AdminColisDesktop />,
};
