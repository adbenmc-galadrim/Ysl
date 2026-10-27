import type { Meta, StoryObj } from '@storybook/react-vite';

import { HomeIndicator } from '#device';
import { PICKUP_EMAIL, SENT_EMAILS } from '#fixtures/emails';
import { FixAddressSheet } from '#screens/notification/fix-address-sheet';
import { PickupEmailScreen } from '#screens/notification/pickup-email-screen';
import {
  MailParcelsSheet,
  SentEmailsScreen,
} from '#screens/notification/sent-emails-screen';
import { MailSentSheet } from '#screens/notification/notifier-screen';

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
  // The employee's Mail, not the app: light whatever the theme.
  globals: { theme: 'clair' },
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
      {
        title: 'Envoyés',
        count: 9,
        emails: [SENT_EMAILS.nora, SENT_EMAILS.ines],
      },
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

const WAITING = {
  id: 'm-hugo-open',
  recipient: 'Hugo Lefèvre',
  state: 'waiting',
  summary: '1 colis DHL',
  status: 'Messagerie ouverte à 10 h 12, sans réponse',
} as const;

const NOT_SENT = {
  id: 'm-marc',
  recipient: 'Marc Petit',
  state: 'failed',
  summary: '1 colis DPD',
  status: 'Non envoyé, d’après l’agent',
} as const;

const RESENT = {
  id: 'm-marc-old',
  recipient: 'Marc Petit',
  state: 'closed',
  summary: '1 colis DPD',
  status: 'Renvoyé à 10 h 20',
} as const;

/**
 * The log as the app fills it (D2: nothing leaves through a server). What
 * the agent has to answer replaces « En file »; no Penpot frame of its own.
 */
export const SuiviDeclaratif: StoryObj<typeof SentEmailsScreen> = {
  name: 'Suivi des e-mails › À confirmer',
  args: {
    filters: [
      { label: 'Tous', selected: true },
      { label: 'À confirmer', count: 1 },
      { label: 'Échecs', count: 1 },
      { label: 'Envoyés' },
    ],
    sections: [
      { title: 'À corriger', emails: [NOT_SENT] },
      { title: 'À confirmer', emails: [WAITING] },
      { title: 'Envoyés', emails: [SENT_EMAILS.nora, SENT_EMAILS.ines] },
      { title: 'Repris', emails: [RESENT] },
    ],
  },
  render: (args) => <SentEmailsScreen {...args} />,
};

export const SuiviVide: StoryObj<typeof SentEmailsScreen> = {
  name: 'Suivi des e-mails › Vide',
  args: {
    filters: [
      { label: 'Tous' },
      { label: 'À confirmer', selected: true },
      { label: 'Échecs' },
      { label: 'Envoyés' },
    ],
    sections: [],
    empty: {
      title: 'Rien à confirmer',
      description:
        'Chaque e-mail ouvert dans la messagerie a reçu une réponse.',
    },
  },
  render: (args) => <SentEmailsScreen {...args} />,
};

export const Confirmer: StoryObj<typeof SentEmailsScreen> = {
  name: 'Suivi des e-mails › Confirmer l’envoi',
  args: {
    ...SuiviDeclaratif.args,
    sheet: <MailSentSheet recipient="Hugo Lefèvre" />,
  },
  render: (args) => <SentEmailsScreen {...args} />,
};

export const ColisDeLEMail: StoryObj<typeof MailParcelsSheet> = {
  name: 'Suivi des e-mails › Colis de l’e-mail',
  args: {
    recipient: 'Nora Haddad',
    status: 'Envoyé à 10 h 58',
    parcels: [
      { id: 'p-4471', title: 'Amazon ···4471', detail: 'Notifié il y a 2 h' },
      { id: 'p-4472', title: 'Amazon ···4472', detail: 'Remis à 11 h 40' },
    ],
  },
  render: (args) => (
    <SentEmailsScreen
      sections={[{ title: 'Envoyés', emails: [SENT_EMAILS.nora] }]}
      sheet={<MailParcelsSheet {...args} />}
    />
  ),
};

export const CorrigerUnContact: StoryObj<typeof FixAddressSheet> = {
  name: 'Corriger l’adresse › Adresse déjà prise',
  args: {
    recipient: 'Marc Petit',
    description: 'Dernier essai : non envoyé, d’après l’agent.',
    value: 'nora.haddad@example.com',
    onValueChange: () => {},
    error:
      'Adresse déjà celle de Nora Haddad. Décochez pour l’écrire sur ces colis seulement.',
    updateLabel: 'Mettre à jour la fiche du contact',
    resendHref: 'mailto:nora.haddad@example.com',
    onShowParcels: () => {},
  },
  render: (args) => (
    <FixAddressSheet {...args} behind={<SentEmailsScreen sections={[]} />} />
  ),
};

export const CorrigerAnnuaireEntreprise: StoryObj<typeof FixAddressSheet> = {
  name: 'Corriger l’adresse › Fiche de l’entreprise',
  args: {
    recipient: 'Inès Garnier',
    description: 'Dernier essai : non envoyé, d’après l’agent.',
    value: 'ines.garnier@example.com',
    onValueChange: () => {},
    updateDisabled: true,
    updateHelp:
      'Fiche venue de l’annuaire de l’entreprise : l’adresse ne vaudra que pour ces colis.',
    resendHref: 'mailto:ines.garnier@example.com',
  },
  render: (args) => (
    <FixAddressSheet {...args} behind={<SentEmailsScreen sections={[]} />} />
  ),
};
