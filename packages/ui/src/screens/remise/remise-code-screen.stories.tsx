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
  parameters: { reference: '07-remise/remise--remise-code' },
  args: { code: '482' },
};

export const Vide: Story = { args: { code: '' } };
