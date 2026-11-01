import type { Meta, StoryObj } from '@storybook/react-vite';

import { QR_4821_PHONE } from '#fixtures/handover';
import { EmployeePhone } from '#screens/remise/employee-phone';
import { ScannerQrScreen } from '#screens/remise/scanner-qr-screen';

const meta = {
  title: 'Écrans/07 Remise/Scanner le QR',
  component: ScannerQrScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ScannerQrScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TelephoneDuSalarie: Story = {
  name: 'Téléphone du salarié',
  args: { subject: <EmployeePhone code="4821" qr={QR_4821_PHONE} /> },
};

/** Nothing in front of the camera yet. */
export const Vide: Story = {};

/** A QR read, but its code was replaced by a later mail: the two ways around it stay below. */
export const QrRemplace: Story = {
  name: 'QR remplacé',
  args: {
    subject: <EmployeePhone code="4821" qr={QR_4821_PHONE} />,
    notice: {
      title: 'Ce QR a été remplacé',
      description:
        'Un e-mail plus récent porte le bon code. Demandez-le, ou cherchez le nom.',
    },
  },
};
