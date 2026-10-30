import type { Meta, StoryObj } from '@storybook/react-vite';

import { NavetteModifierMobile } from '#screens/multi-entreprises/10-colis/navette-modifier-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/10 Colis/Navette',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ModifierLeColis: Story = {
  name: 'Modifier le colis · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--navette-modifier-le-colis-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteModifierMobile />,
};
