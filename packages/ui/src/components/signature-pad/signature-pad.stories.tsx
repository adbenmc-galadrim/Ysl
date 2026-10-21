import type { Meta, StoryObj } from '@storybook/react-vite';

import { SignaturePad } from '#components/signature-pad';
import { SIGNATURES } from '#fixtures/signatures';

const meta = {
  title: 'Composants/SignaturePad',
  component: SignaturePad,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: { className: 'h-[420px]' },
} satisfies Meta<typeof SignaturePad>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Uncontrolled: draw in it with the mouse or a finger. */
export const Vide: Story = {};

export const Signee: Story = { args: { strokes: SIGNATURES.nora } };

export const Compacte: Story = {
  args: { className: 'h-[220px]', strokes: [] },
};
