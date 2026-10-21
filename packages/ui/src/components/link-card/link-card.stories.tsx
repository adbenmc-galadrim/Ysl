import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinkCard } from '#components/link-card';

const meta = {
  title: 'Composants/LinkCard',
  component: LinkCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LinkCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RetirePar: Story = {
  args: { icon: 'user', label: 'Retiré par quelqu’un d’autre' },
};
