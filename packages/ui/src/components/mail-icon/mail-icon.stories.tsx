import type { Meta, StoryObj } from '@storybook/react-vite';

import { MailIcon } from '#components/mail-icon';

const meta = {
  title: 'Composants/MailIcon',
  component: MailIcon,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MailIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Telephone: Story = { name: 'Téléphone', args: { size: 38 } };

export const Ordinateur: Story = { args: { size: 40 } };
