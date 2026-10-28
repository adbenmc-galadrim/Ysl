import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmailPreview } from '#components/email-preview';
import { PickupCode } from '#components/pickup-code';
import { PICKUP_EMAIL, QR_4821 } from '#fixtures/emails';

const meta = {
  title: 'Composants/EmailPreview',
  component: EmailPreview,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Retrait: Story = {
  args: {
    subject: PICKUP_EMAIL.subject,
    sender: PICKUP_EMAIL.sender,
    meta: `À : ${PICKUP_EMAIL.to}, ${PICKUP_EMAIL.sentAt}`,
    children: (
      <>
        <p className="text-15">Bonjour Nora,</p>
        <PickupCode code="4821" qr={QR_4821} className="mt-3.5" />
      </>
    ),
  },
};

export const SansAvatarParDefaut: Story = {
  args: {
    subject: 'Votre colis a été remis',
    sender: 'Service courrier',
    meta: 'À : Hugo Lefèvre, hier 17:40',
    avatar: (
      <span className="flex size-10 items-center justify-center rounded-tile bg-fill text-15 font-semibold">
        SC
      </span>
    ),
    children: (
      <p className="text-15">Bonjour Hugo, votre colis DHL a été remis.</p>
    ),
  },
};
