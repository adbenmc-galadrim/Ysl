import type { Meta, StoryObj } from '@storybook/react-vite';

import { HomeIndicator } from '#device';
import { PICKUP_EMAIL, SENT_EMAILS } from '#fixtures/emails';
import { FixAddressSheet } from '#screens/notification/fix-address-sheet';
import { PickupEmailScreen } from '#screens/notification/pickup-email-screen';
import { SentEmailsScreen } from '#screens/notification/sent-emails-screen';

/**
 * The pickup e-mail from both ends: as the employee reads it, and as the
 * agent follows what was sent, queued or refused.
 */
const meta = {
  title: 'Écrans/06 Notification/Notification',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

export const EMailRecuParLeSalarie: StoryObj<typeof PickupEmailScreen> = {
  name: 'E-mail reçu par le salarié',
  parameters: {
    reference: '06-notification/notification--e-mail-recu-par-le-salarie',
  },
  args: { email: PICKUP_EMAIL },
  render: (args) => <PickupEmailScreen {...args} />,
};

export const SuiviDesEMails: StoryObj<typeof SentEmailsScreen> = {
  name: 'Suivi des e-mails',
  parameters: { reference: '06-notification/notification--suivi-des-e-mails' },
  args: {
    filters: [
      { label: 'Aujourd’hui', selected: true },
      { label: 'Échecs', count: 1 },
      { label: 'En file', count: 2 },
    ],
    sections: [
      { title: 'À corriger', emails: [SENT_EMAILS.paul] },
      { title: 'En file', emails: [SENT_EMAILS.hugo, SENT_EMAILS.camille] },
      { title: 'Envoyés', count: 9, emails: [SENT_EMAILS.nora, SENT_EMAILS.ines] },
    ],
  },
  render: (args) => <SentEmailsScreen {...args} />,
};

export const CorrigerLAdresse: StoryObj<typeof FixAddressSheet> = {
  name: 'Corriger l’adresse',
  parameters: { reference: '06-notification/notification--corriger-l-adresse' },
  args: {
    recipient: 'Paul Mercier',
    rejected: 'p.mercier@saint-laurent',
    reason: 'il manque la fin de l’adresse.',
    value: 'paul.mercier@saint-laurent.fr',
  },
  // Behind the sheet the log is drawn bare, as in the mockup: the sheet is
  // the subject, the list would only add noise under the scrim.
  //
  // This mockup also draws the home indicator over the sheet (others hide
  // it under theirs), so the story repeats it above the sheet's layer.
  render: (args) => (
    <>
      <FixAddressSheet {...args} behind={<SentEmailsScreen sections={[]} />} />
      <div className="pointer-events-none absolute inset-0 z-[61]">
        <HomeIndicator />
      </div>
    </>
  ),
};
