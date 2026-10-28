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

/** As the app shows it until the handover is recorded: read only, the button waits. */
export const ChoisiParLeNom: Story = {
  name: 'Choisi par le nom',
  args: {
    recipient: PEOPLE.nora,
    verified: 'Choisi par le nom',
    verifiedBy: 'name',
    parcels: NORA_HANDOVER,
    extras: false,
    confirmNote: 'La remise arrive bientôt dans l’app.',
  },
};

/** The code was right, but nothing waits for them any more. */
export const AucunColis: Story = {
  name: 'Aucun colis',
  args: {
    recipient: PEOPLE.nora,
    verified: 'Code vérifié à 11 h 20',
    parcels: [],
    empty: 'Rien n’attend Nora au comptoir.',
    extras: false,
    confirmNote: 'La remise arrive bientôt dans l’app.',
  },
};
