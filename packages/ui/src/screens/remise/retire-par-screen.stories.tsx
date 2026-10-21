import type { Meta, StoryObj } from '@storybook/react-vite';

import { PEOPLE } from '#fixtures/people';
import { RetireParScreen } from '#screens/remise/retire-par-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Remise/Retiré par un collègue',
  component: RetireParScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RetireParScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Annonce: Story = {
  name: 'Annoncé par e-mail',
  parameters: { reference: '09-zones-d-ombre/remise--retire-par-un-collegue' },
  args: {
    recipient: PEOPLE.nora,
    collector: PEOPLE.paul,
    announcement: 'Réponse à l’e-mail, ce matin à 11 h 02',
    proof: 'signature',
  },
};

export const PhotoDuBadge: Story = {
  name: 'Photo du badge',
  args: { ...Annonce.args, announcement: undefined, proof: 'badge' },
};
