import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  JournalChargementMobile,
  JournalDesktop,
  JournalMobile,
  JournalVideMobile,
} from '#screens/multi-entreprises/06-journal-de-la-plateforme/journal-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/06 Journal de la plateforme/Journal',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };
const page =
  'multi-entreprises/06-journal-de-la-plateforme/journal--admin-de-l-app-journal-';

export const Ordinateur: Story = {
  name: 'Journal · ordinateur',
  parameters: { reference: `${page}ordinateur` },
  globals: desktop,
  render: () => <JournalDesktop />,
};

export const Mobile: Story = {
  name: 'Journal · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}mobile` },
  globals: mobile,
  render: () => <JournalMobile />,
};

export const ChargementMobile: Story = {
  name: 'Chargement · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}chargement-mobile` },
  globals: mobile,
  render: () => <JournalChargementMobile />,
};

export const VideMobile: Story = {
  name: 'Vide · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}vide-mobile` },
  globals: mobile,
  render: () => <JournalVideMobile />,
};
