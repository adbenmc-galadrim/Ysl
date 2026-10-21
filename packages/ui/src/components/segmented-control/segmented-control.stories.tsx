import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SegmentedControl } from '#components/segmented-control';

const KINDS = ['Colis', 'Recommandé', 'Courrier'] as const;

const meta = {
  title: 'Composants/SegmentedControl',
  component: SegmentedControl<string>,
  decorators: [
    (Story) => (
      <div className="w-[301px]">
        <Story />
      </div>
    ),
  ],
  args: { options: KINDS, value: 'Recommandé', label: 'Type d’envoi' },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Clair: Story = {};

/** Over the camera picture. */
export const Nuit: Story = {
  args: { tone: 'night' },
  decorators: [
    (Story) => (
      <div className="bg-scene p-4">
        <Story />
      </div>
    ),
  ],
};

export const Interactif: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
};
