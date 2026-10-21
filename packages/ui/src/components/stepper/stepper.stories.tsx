import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Stepper } from '#components/stepper';

const meta = {
  title: 'Composants/Stepper',
  component: Stepper,
  args: { label: 'Nombre de colis', value: 1 },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Stepper {...args} value={value} onValueChange={setValue} />;
  },
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AuMinimum: Story = { name: 'Au minimum' };

export const Plusieurs: Story = { args: { value: 3 } };

export const AuMaximum: Story = { name: 'Au maximum', args: { value: 9, max: 9 } };
