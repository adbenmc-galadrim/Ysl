import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton, SkeletonRow, SkeletonSection } from '#components/skeleton';

const meta = {
  title: 'Composants/Skeleton',
  component: Skeleton,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Barre: Story = { args: { width: 160, height: 14 } };

export const Ligne: Story = { render: () => <SkeletonRow separator={false} /> };

export const Section: Story = { render: () => <SkeletonSection /> };
