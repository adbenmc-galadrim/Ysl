import type { Meta, StoryObj } from '@storybook/react-vite';

import { RemiseCodeScreen } from '#screens/remise/remise-code-screen';

const meta = {
  title: 'Écrans/07 Remise/Remise code',
  component: RemiseCodeScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RemiseCodeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TroisChiffres: Story = {
  name: 'Trois chiffres saisis',
  args: { code: '482' },
};

export const Vide: Story = { args: { code: '' } };

/** A wrong code: the boxes are cleared and turn red until the next digit. */
export const CodeDejaServi: Story = {
  name: 'Code déjà servi',
  args: {
    code: '',
    error: 'Ce code a déjà servi. Cherchez plutôt le nom.',
    onSearchName: () => {},
  },
};

/** Five wrong codes in a row: the pad waits before the next try. */
export const Bloque: Story = {
  name: 'Trop d’essais',
  args: {
    code: '',
    locked: 'Trop d’essais. Réessayez dans 30 s, ou cherchez le nom.',
  },
};
