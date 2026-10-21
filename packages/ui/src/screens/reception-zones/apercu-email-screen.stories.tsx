import type { Meta, StoryObj } from '@storybook/react-vite';

import { EMAIL_DRAFTS } from '#fixtures/email-drafts';
import { ApercuEmailScreen } from '#screens/reception-zones/apercu-email-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Réception/Aperçu de l’e-mail',
  component: ApercuEmailScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ApercuEmailScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ApercuDeLEmail: Story = {
  name: 'Aperçu de l’e-mail',
  parameters: { reference: '09-zones-d-ombre/reception--apercu-de-l-e-mail' },
  args: { position: 1, total: 9, ...EMAIL_DRAFTS.nora },
};
