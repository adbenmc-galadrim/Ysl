import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconTile } from '#components/icon-tile';

const meta = {
  title: 'Composants/IconTile',
  component: IconTile,
  args: { icon: 'package' },
} satisfies Meta<typeof IconTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutre: Story = {};

/** The status column of the parcel list, one tone per state. */
export const Teintes: Story = {
  render: () => (
    <div className="flex gap-3">
      <IconTile icon="alert" tone="red" />
      <IconTile icon="package" tone="neutral" />
      <IconTile icon="mail" tone="blue" />
      <IconTile icon="clock" tone="orange" />
      <IconTile icon="check" tone="green" />
      <IconTile icon="users" tone="grey" />
      <IconTile icon="info" tone="fill" />
    </div>
  ),
};
