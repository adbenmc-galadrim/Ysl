import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  LieuLectureDesktop,
  LieuLectureMobile,
} from '#screens/multi-entreprises/20-reglages-du-compte/lieu-lecture-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/20 Réglages du compte/Lieu et horaires',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const props = {
  title: 'Lieu et horaires',
  subtitle: 'Studio',
  items: [
    { label: 'Lieu', value: 'Bât. A, 2e étage, accueil' },
    { label: 'Lundi', value: '9 h – 17 h' },
    { label: 'Consignes', value: 'Présenter le QR reçu par e-mail.' },
  ],
  footer: 'Réglés par l’administrateur de l’entreprise.',
};

export const Mobile: Story = {
  parameters: { device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <LieuLectureMobile {...props} />,
};

export const Ordinateur: Story = {
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <LieuLectureDesktop {...props} />,
};
