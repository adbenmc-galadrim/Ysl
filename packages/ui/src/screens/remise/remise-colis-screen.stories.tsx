import type { Meta, StoryObj } from '@storybook/react-vite';

import { NORA_HANDOVER } from '#fixtures/handover';
import { PEOPLE } from '#fixtures/people';
import { RemiseColisScreen } from '#screens/remise/remise-colis-screen';

const meta = {
  title: 'Écrans/07 Remise/Remise colis',
  component: RemiseColisScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RemiseColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const QrVerifie: Story = {
  name: 'QR vérifié',
  parameters: { reference: '07-remise/remise--remise-colis' },
  args: {
    recipient: PEOPLE.nora,
    location: '3e étage',
    verified: 'QR code vérifié à 11 h 20',
    parcels: NORA_HANDOVER,
  },
};

/** One parcel left on the shelf: the button counts two. */
export const Partielle: Story = {
  args: { ...QrVerifie.args, excluded: ['p-4472'] },
};
