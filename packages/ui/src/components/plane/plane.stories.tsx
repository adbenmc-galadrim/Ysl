import type { Meta, StoryObj } from '@storybook/react-vite';

import { Plane } from '#components/plane';

const meta = {
  title: 'Composants/Plane',
  component: Plane,
  parameters: { layout: 'centered' },
  args: { size: 24, className: 'fill-ios-orange-light' },
} satisfies Meta<typeof Plane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tailles: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      <Plane {...args} size={16} />
      <Plane {...args} size={24} />
      <Plane {...args} size={28} />
    </div>
  ),
};

export const SurPastille: Story = {
  name: 'Sur pastille',
  args: { className: 'fill-white' },
  decorators: [
    (Story) => (
      <div className="flex size-12 items-center justify-center rounded-full bg-ios-orange-light">
        <Story />
      </div>
    ),
  ],
};
