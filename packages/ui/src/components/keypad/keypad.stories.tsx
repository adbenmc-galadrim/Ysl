import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { CodeInput } from '#components/code-input';
import { Keypad } from '#components/keypad';

const meta = {
  title: 'Composants/Keypad',
  component: Keypad,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Keypad>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = { args: {} };

/** Wired to a `CodeInput`, as on the pickup code screen. */
export const AvecCode: Story = {
  render: () => {
    const [code, setCode] = useState('48');
    return (
      <div className="flex flex-col gap-10">
        <CodeInput value={code} />
        <Keypad
          onDigit={(d) => setCode((c) => (c.length < 4 ? c + d : c))}
          onDelete={() => setCode((c) => c.slice(0, -1))}
        />
      </div>
    );
  },
};

/** With `onLetter`: the "ABC" key opens the letter grid, same height. */
export const Lettres: Story = {
  render: () => {
    const [value, setValue] = useState('1ZE6');
    return (
      <div className="flex flex-col gap-10">
        <p className="font-mono text-20 font-medium">{value || ' '}</p>
        <Keypad
          letters
          onDigit={(d) => setValue((v) => v + d)}
          onLetter={(l) => setValue((v) => v + l)}
          onDelete={() => setValue((v) => v.slice(0, -1))}
        />
      </div>
    );
  },
};
