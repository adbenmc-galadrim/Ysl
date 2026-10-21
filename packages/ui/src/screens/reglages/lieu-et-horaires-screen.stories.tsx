import type { Meta, StoryObj } from '@storybook/react-vite';

import { LieuEtHorairesScreen } from '#screens/reglages/lieu-et-horaires-screen';

const meta = {
  title: 'Écrans/08 Réglages/Lieu et horaires',
  component: LieuEtHorairesScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof LieuEtHorairesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const WEEK = '9:00–12:30, 14:00–18:00';

export const LieuEtHoraires: Story = {
  name: 'Lieu et horaires',
  parameters: { reference: '08-reglages/reglages--lieu-et-horaires' },
  args: {
    place: 'Rez-de-chaussée, comptoir courrier',
    hours: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map((day) => ({
      day,
      hours: WEEK,
    })),
    reminders: {
      header: 'Relances automatiques',
      footer:
        'Jours ouvrés uniquement. Ces informations apparaissent dans chaque e-mail.',
      items: [
        { icon: 'bell', color: 'purple', label: 'Relances', toggle: true },
        {
          icon: 'calendar',
          color: 'purple',
          label: 'Première relance',
          value: 'Après 2 jours',
        },
        {
          icon: 'calendar',
          color: 'purple',
          label: 'Deuxième relance',
          value: 'Après 5 jours',
        },
        {
          icon: 'alert',
          color: 'orange',
          label: 'En souffrance après',
          value: '7 jours',
        },
      ],
    },
  },
};
