import type { EmailDraftProps } from '#components/email-draft';

/**
 * Pickup e-mails as the agent proofreads them before a batch send. Nora is
 * the recipient with several parcels, so her e-mail shows the plural forms.
 */
export const EMAIL_DRAFTS = {
  nora: {
    recipient: {
      name: 'Nora Haddad',
      initials: 'NH',
      email: 'nora.haddad@saint-laurent.fr',
    },
    draft: {
      subject: '2 colis vous attendent au service courrier',
      body: 'Bonjour Nora, deux colis sont arrivés pour vous. Présentez ce QR code ou donnez le code au comptoir.',
      code: '4821',
      parcels: [
        'Amazon ···4471, reçu à 10 h 15',
        'Amazon ···4472, reçu à 10 h 15',
      ],
      footer:
        'Rez-de-chaussée, comptoir courrier. Lun. au ven., 9 h à 12 h 30 et 14 h à 18 h.',
      note: {
        label: 'Message de l’agent (facultatif)',
        text: 'Un des colis est volumineux, prévoyez de quoi le transporter.',
      },
    } satisfies EmailDraftProps,
  },
};
