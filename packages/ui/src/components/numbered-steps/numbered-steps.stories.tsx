import type { Meta, StoryObj } from '@storybook/react-vite';

import { NumberedSteps } from '#components/numbered-steps';

const meta = {
  title: 'Composants/NumberedSteps',
  component: NumberedSteps,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberedSteps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReglagesCamera: Story = {
  args: {
    steps: [
      'Ouvrez Réglages sur l’iPhone',
      'Touchez Safari, puis Caméra',
      'Choisissez « Autoriser »',
      'Revenez dans Courrier YSL',
    ],
  },
};
