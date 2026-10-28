import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  MailSentSheet,
  NotifierScreen,
} from '#screens/notification/notifier-screen';

const BODY = [
  'Bonjour Nora,',
  '',
  'Votre code de retrait : 4821',
  '',
  'Nous avons reçu pour vous :',
  '• Amazon ···4471, reçu à 10 h 15',
  '• UPS ···0622, de Zalando, 2 pièces sur 3, reçu à 10 h 15',
  '',
  'Où : Rez-de-chaussée, comptoir courrier',
  'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
  '',
  'Donnez votre code au comptoir du service courrier.',
  '',
  "Ce n’est pas pour vous ? mailto:karim.daoud@example.com?subject=Ce%20n'est%20pas%20pour%20moi%20-%20Nora%20Haddad",
  'Un collègue viendra le chercher ? mailto:karim.daoud@example.com?subject=Un%20coll%C3%A8gue%20viendra%20le%20chercher%20-%20Nora%20Haddad',
  '',
  'Karim Daoud',
  'Service Courrier',
].join('\n');

/**
 * The mails of the "À notifier" parcels, one per recipient, laid out as
 * « Aperçu de l'e-mail » (09 · Zones d'ombre) with one "Envoyer" per page:
 * no Penpot frame of its own, hence no reference.
 */
const meta = {
  title: 'Écrans/06 Notification/Notifier',
  component: NotifierScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    position: 1,
    total: 9,
    recipient: {
      name: 'Nora Haddad',
      initials: 'NH',
      email: 'nora.haddad@example.com',
    },
    state: 'ready',
    template: { name: 'Avis de retrait', onClick: () => {} },
    onEditTemplate: () => {},
    preview: {
      subject: '2 colis en attente de retrait – Service Courrier',
      body: BODY,
    },
    sendLabel: 'Envoyer à Nora',
    sendHref: 'mailto:nora.haddad@example.com',
    shareLabel: 'Partager avec le QR',
    shareHint:
      'Le texte et le QR de retrait partent par la feuille de partage ; saisissez l’adresse dans la messagerie.',
    onShare: () => {},
    nextLabel: 'Suivant',
  },
} satisfies Meta<typeof NotifierScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Apercu: Story = { name: 'Aperçu' };

export const DemandeDeConfirmation: Story = {
  name: 'L’e-mail est-il parti ?',
  args: { sheet: <MailSentSheet recipient="Nora Haddad" /> },
};

export const Envoye: Story = {
  name: 'Envoyé',
  args: {
    state: 'sent',
    sendLabel: 'E-mail envoyé',
    notice: {
      title: 'E-mail envoyé',
      description: '2 colis passent « Notifié ».',
    },
  },
};

export const NonEnvoye: Story = {
  name: 'Non envoyé',
  args: {
    state: 'failed',
    notice: {
      title: 'Pas envoyé',
      description:
        'Les colis restent « À notifier ». Renvoyez quand vous voulez.',
    },
  },
};

export const AdresseManquante: Story = {
  name: 'Adresse manquante',
  args: {
    position: 2,
    recipient: {
      name: 'Marc Petit',
      initials: 'MP',
      missing: 'Adresse manquante',
    },
    state: 'missing',
    sendHref: undefined,
    sendLabel: 'Envoyer à Marc',
    completeLabel: 'Compléter la fiche',
    notice: {
      title: 'Pas d’adresse e-mail',
      description: 'Saisissez-la sur la fiche du colis pour lui écrire.',
    },
    preview: {
      subject: '2 colis en attente de retrait – Service Courrier',
      body: BODY.replace('Nora', 'Marc Petit'),
    },
  },
};

export const VariableNonRenseignee: Story = {
  name: 'Lieu non renseigné',
  args: {
    position: 9,
    nextLabel: 'Terminer',
    warnings: [
      {
        title: 'Lieu ou horaires de retrait non renseignés',
        description: 'Réglages › Lieu et horaires de retrait.',
      },
    ],
  },
};
