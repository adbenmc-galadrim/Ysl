import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from '#components/progress-bar';

const meta = {
  title: 'Composants/ProgressBar',
  component: ProgressBar,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[301px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EnCours: Story = { args: { value: 0.43 } };

export const Termine: Story = { args: { value: 1, tone: 'green' } };

export const EnPause: Story = { args: { value: 0.43, tone: 'orange' } };
