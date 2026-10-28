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
    onToggle: () => {},
    onToggleAll: () => {},
    onConfirm: () => {},
  },
};

/** One parcel left on the shelf: the button counts two, the header offers to tick all again. */
export const Partielle: Story = {
  args: { ...QrVerifie.args, excluded: ['p-4472'] },
};

/** The label told the sender, and one parcel came damaged: shown before it is handed. */
export const ExpediteurEtReserve: Story = {
  name: 'Expéditeur et réserve',
  args: {
    ...QrVerifie.args,
    parcels: [
      { ...NORA_HANDOVER[0]!, sender: 'Zalando' },
      { ...NORA_HANDOVER[1]!, sender: 'Fnac', damaged: true },
      NORA_HANDOVER[2]!,
    ],
  },
};

/** Picked by the name: nothing was checked, the signature is still to come (YSL-75). */
export const ChoisiParLeNom: Story = {
  name: 'Choisi par le nom',
  args: {
    recipient: PEOPLE.nora,
    verified: 'Sans vérification',
    verifiedBy: 'name',
    signatureNote: 'bientôt',
    parcels: NORA_HANDOVER,
    extras: false,
    onToggle: () => {},
    onToggleAll: () => {},
    onConfirm: () => {},
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
  },
};
