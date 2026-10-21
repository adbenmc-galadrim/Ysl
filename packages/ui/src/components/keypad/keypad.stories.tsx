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
