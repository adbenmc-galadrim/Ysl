import type { Meta, StoryObj } from '@storybook/react-vite';

import { QrCode } from '#components/qr-code';
import { QR_4821 } from '#fixtures/emails';

const meta = {
  title: 'Composants/QrCode',
  component: QrCode,
  parameters: { layout: 'centered', backgrounds: { value: 'light' } },
  decorators: [
    (Story) => (
      <div className="bg-fill p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QrCode>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Retrait: Story = { args: { matrix: QR_4821, label: 'Code 4821' } };

export const Petit: Story = { args: { matrix: QR_4821, module: 5 } };
