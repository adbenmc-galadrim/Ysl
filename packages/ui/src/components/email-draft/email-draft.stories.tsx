import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmailDraft, EmailRecipient } from '#components/email-draft';
import { EMAIL_DRAFTS } from '#fixtures/email-drafts';

const meta = {
  title: 'Composants/EmailDraft',
  component: EmailDraft,
  parameters: { layout: 'padded', backgrounds: { default: 'fill' } },
  decorators: [
    (Story) => (
      <div className="w-[353px] bg-fill p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailDraft>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvecMessage: Story = { args: EMAIL_DRAFTS.nora.draft };

export const SansMessage: Story = {
  args: { ...EMAIL_DRAFTS.nora.draft, note: undefined },
};

/** The recipient card that sits above the draft. */
export const Destinataire: Story = {
  args: EMAIL_DRAFTS.nora.draft,
  render: () => <EmailRecipient {...EMAIL_DRAFTS.nora.recipient} />,
};
