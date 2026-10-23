import type { Meta, StoryObj } from '@storybook/react-vite';

import { ParcelThumb } from '#components/parcel-thumb';

const meta = {
  title: 'Composants/ParcelThumb',
  component: ParcelThumb,
  parameters: { layout: 'centered' },
  args: { size: 44, tone: 'kraft' },
} satisfies Meta<typeof ParcelThumb>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Kraft: Story = {};

export const Teintes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {([44, 40] as const).map((size) => (
        <div key={size} className="flex gap-3">
          {(['kraft', 'mid', 'light', 'deep', 'dark'] as const).map((tone) => (
            <ParcelThumb key={tone} {...args} size={size} tone={tone} />
          ))}
        </div>
      ))}
    </div>
  ),
};
