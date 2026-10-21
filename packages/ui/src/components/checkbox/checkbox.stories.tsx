import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Checkbox } from '#components/checkbox';

const meta = {
  title: 'Composants/Checkbox',
  component: Checkbox,
  args: { label: 'Sélectionner Inès Garnier', checked: false },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NonCoche: Story = { name: 'Non coché' };

export const Coche: Story = { name: 'Coché', args: { checked: true } };

export const Interactif: Story = {
  render: (args) => {
    const [checked, setChecked] = useState(args.checked);
    return (
      <Checkbox {...args} checked={checked} onCheckedChange={setChecked} />
    );
  },
};
