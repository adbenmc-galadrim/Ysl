import type { Meta, StoryObj } from '@storybook/react-vite';

import { CheckList } from '#components/check-list';

const meta = {
  title: 'Composants/CheckList',
  component: CheckList,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Complete: Story = {
  args: {
    items: [
      { icon: 'qr', label: 'QR code vérifié', done: true },
      { icon: 'sign', label: 'Signature enregistrée', done: true },
      { icon: 'cloud', label: 'Envoyé au serveur', done: true },
    ],
  },
};

/** Offline: the handover is kept on the phone until it can be sent. */
export const EnAttente: Story = {
  args: {
    items: [
      { icon: 'qr', label: 'QR code vérifié', done: true },
      { icon: 'sign', label: 'Signature enregistrée', done: true },
      { icon: 'cloud', label: 'Envoi dès le retour du réseau' },
    ],
  },
};
