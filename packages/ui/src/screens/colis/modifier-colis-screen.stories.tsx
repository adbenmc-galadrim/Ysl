import type { Meta, StoryObj } from '@storybook/react-vite';

import { PARCELS } from '#fixtures/parcels';
import { ModifierColisScreen } from '#screens/colis/modifier-colis-screen';

const meta = {
  title: 'Écrans/05 Colis/Modifier le colis',
  component: ModifierColisScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ModifierColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const camille = PARCELS.camille;

export const ModifierLeColis: Story = {
  name: 'Modifier le colis',
  parameters: { reference: '05-colis/colis--modifier-le-colis' },
  args: {
    recipient: `${camille.recipient}, ${camille.department}`,
    tracking: camille.tracking,
    trackingCheck: { ok: true, text: 'Clé de contrôle UPS valide' },
    carrier: camille.carrier,
    sender: camille.sender,
    senderHelp: 'Retenu pour les prochains colis de ce compte UPS',
    pieces: camille.pieces,
  },
};
