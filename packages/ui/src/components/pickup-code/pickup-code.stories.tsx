import type { Meta, StoryObj } from '@storybook/react-vite';

import { PickupCode } from '#components/pickup-code';
import { QR_4821 } from '#fixtures/emails';

const meta = {
  title: 'Composants/PickupCode',
  component: PickupCode,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PickupCode>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvecValidite: Story = {
  args: { code: '4821', qr: QR_4821, validity: 'Valable jusqu’au retrait' },
};

export const Simple: Story = { args: { code: '4821', qr: QR_4821 } };
