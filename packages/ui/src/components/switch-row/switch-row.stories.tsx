import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SwitchRow } from '#components/switch-row';

const meta = {
  title: 'Composants/SwitchRow',
  component: SwitchRow,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SwitchRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { label: 'Prévenir dans l’e-mail au salarié', checked: true },
};

export const Inactive: Story = {
  args: { label: 'Réserve auprès du transporteur', checked: false },
};

export const Interactive: Story = {
  args: { label: 'Réserve auprès du transporteur', checked: false },
  render: (args) => {
    const [checked, setChecked] = useState(args.checked);
    return <SwitchRow {...args} checked={checked} onCheckedChange={setChecked} />;
  },
};
