import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Switch } from '#components/switch';

const meta = {
  title: 'Composants/Switch',
  component: Switch,
  args: { checked: true, label: 'Son au scan' },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Desactive: Story = { name: 'Désactivé', args: { checked: false } };

export const Indisponible: Story = { args: { disabled: true } };

/** Wired to state, to try the knob. */
export const Interactif: Story = {
  render: (args) => {
    const [on, setOn] = useState(args.checked);
    return <Switch {...args} checked={on} onCheckedChange={setOn} />;
  },
};
