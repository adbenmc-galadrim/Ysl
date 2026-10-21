import type { Meta, StoryObj } from '@storybook/react-vite';

import { PieceDots } from '#components/piece-dots';

const meta = {
  title: 'Composants/PieceDots',
  component: PieceDots,
  parameters: { layout: 'padded', backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="inline-flex rounded-card bg-night p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PieceDots>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DeuxSurTrois: Story = { args: { total: 3, read: 2 } };

export const Complet: Story = { args: { total: 4, read: 4 } };
