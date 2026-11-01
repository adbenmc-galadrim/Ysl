import type { Meta, StoryObj } from '@storybook/react-vite';

import { SIGNATURES } from '#fixtures/signatures';
import { SignatureScreen } from '#screens/remise/signature-screen';

const meta = {
  title: 'Écrans/07 Remise/Signature',
  component: SignatureScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof SignatureScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Signee: Story = {
  name: 'Signée',
  args: {
    title: 'Nora Haddad signe pour 3 colis',
    detail: 'Dont 1 recommandé UPS ···8810',
    strokes: SIGNATURES.nora,
  },
};

/** Before the first stroke: the button waits for a signature. */
export const Vide: Story = {
  args: { ...Signee.args, strokes: [] },
};
