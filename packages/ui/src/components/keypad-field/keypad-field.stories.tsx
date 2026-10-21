import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Keypad } from '#components/keypad';
import { KeypadField, KeypadFieldHint } from '#components/keypad-field';

const meta = {
  title: 'Composants/KeypadField',
  component: KeypadField,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: { value: '8779 7487 33' },
} satisfies Meta<typeof KeypadField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Saisie: Story = {};

export const Vide: Story = { args: { value: '', placeholder: 'Numéro de suivi' } };

/** Wired to the `Keypad`, grouping digits by four as they are typed. */
export const AvecClavier: Story = {
  name: 'Avec clavier',
  render: () => {
    const [digits, setDigits] = useState('877974873');
    const grouped = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    return (
      <div className="flex flex-col">
        <KeypadField value={grouped} />
        <KeypadFieldHint className="mt-[15px]">Format FedEx reconnu</KeypadFieldHint>
        <Keypad
          className="mt-[27px]"
          onDigit={(d) => setDigits((v) => v + d)}
          onDelete={() => setDigits((v) => v.slice(0, -1))}
        />
      </div>
    );
  },
};
