import type { Meta, StoryObj } from '@storybook/react-vite';

import { Glow } from '#components/glow';

/** A blurred colour bloom behind a section; its colour is the text colour. */
const meta = {
  title: 'Composants/Glow',
  component: Glow,
  parameters: { layout: 'centered' },
  args: { x: 80, y: 60, w: 240, h: 180, alpha: 0.4, sigma: 60, className: 'text-kraft' },
  decorators: [
    (Story) => (
      <div className="relative isolate h-[300px] w-[400px] bg-white">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Glow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Kraft: Story = {};

export const Bleu: Story = { args: { className: 'text-site-blue', alpha: 0.2 } };
