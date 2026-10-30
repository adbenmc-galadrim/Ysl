import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ReglagesMobile,
  SynchronisationMobile,
} from '#screens/multi-entreprises/20-reglages-du-compte/reglages-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/20 Réglages du compte/Département · Réglages',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PhoneReglages: Story = {
  name: 'Réglages · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/20-reglages-du-compte/reglages--departement-reglages-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ReglagesMobile />,
};

export const PhoneSynchronisation: Story = {
  name: 'Synchronisation · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/20-reglages-du-compte/reglages--departement-synchronisation-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <SynchronisationMobile />,
};
