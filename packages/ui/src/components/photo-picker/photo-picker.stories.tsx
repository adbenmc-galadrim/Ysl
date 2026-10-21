import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelThumb } from '#components/label-thumb';
import { PhotoPicker } from '#components/photo-picker';

const meta = {
  title: 'Composants/PhotoPicker',
  component: PhotoPicker,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhotoPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Vide: Story = { args: {} };

export const UnePhoto: Story = {
  args: {
    children: <LabelThumb width={104} height={104} radius={14} tone="deep" />,
  },
};
