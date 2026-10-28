/**
 * The pickup e-mails of the demo mailroom: the one Nora receives, and the
 * day's sending log the agent follows. Same cast as `parcels.ts`.
 */

import { encodeQr } from '#lib/qr';
import type { SentEmail } from '#screens/notification/sent-emails-screen';

/** Modules of the QR for code 4821, as drawn in the mockup. */
export const QR_4821 = [
  '####..#..####',
  '#..##..#.####',
  '#..#.....####',
  '####..#..####',
  '.#..#..#..#..',
  '.............',
  '#..#..#..#..#',
  '.#..#..#..#..',
  '.............',
  '####..#..#..#',
  '#####..#..#..',
  '####.........',
  '####..#..#..#',
];

export type PickupEmail = {
  subject: string;
  /** The agent: the mail leaves from their own mailbox (D2, S5). */
  sender: string;
  to: string;
  sentAt: string;
  /** Plain text, as the `mailto:` carries it (S5). */
  body: string;
  /** The QR the share sheet adds, inserted at the foot by Mail (S5). */
  qr?: string[];
};

/** A pickup token as `newPickupToken` draws it (`@repo/contract/pickup`). */
export const SAMPLE_PICKUP_TOKEN =
  'YSL:RETRAIT:K7Q2M4ZPXW3RTN6V5BHJD5CFLGSYA2EQ';

/**
 * The default template (`DEFAULT_TEMPLATES.avis`) rendered on the sample
 * parcels and the sample pickup (`SAMPLE_MAIL`, `SAMPLE_PICKUP_VALUES`), as
 * the contract's test spells it out.
 */
export const PICKUP_EMAIL = {
  subject: '2 colis en attente de retrait – Service Courrier',
  sender: 'Karim Daoud',
  to: 'Nora Haddad',
  sentAt: 'aujourd’hui 10:58',
  body: [
    'Bonjour Nora,',
    '',
    'Votre code de retrait : 4821',
    '',
    'Nous avons reçu pour vous :',
    '• Amazon ···4471, reçu à 10 h 15',
    '• Amazon ···4472, reçu à 10 h 15',
    '',
    'Où : Rez-de-chaussée, comptoir courrier',
    'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
    '',
    'Donnez votre code au comptoir du service courrier. Un colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
    '',
    'Karim Daoud',
    'Service Courrier',
  ].join('\n'),
  qr: encodeQr(SAMPLE_PICKUP_TOKEN, 'M'),
} satisfies PickupEmail;

export const SENT_EMAILS = {
  paul: {
    id: 'm-paul',
    recipient: 'Paul Mercier',
    state: 'failed',
    summary: '1 colis DPD',
    status: 'Adresse refusée par le serveur',
  },
  hugo: {
    id: 'm-hugo',
    recipient: 'Hugo Lefèvre',
    state: 'queued',
    summary: '1 colis DHL',
    status: 'Partira au retour du réseau',
  },
  camille: {
    id: 'm-camille',
    recipient: 'Camille Morel',
    state: 'queued',
    summary: '1 colis UPS',
    status: 'Partira au retour du réseau',
  },
  nora: {
    id: 'm-nora',
    recipient: 'Nora Haddad',
    state: 'sent',
    summary: '2 colis Amazon',
    status: 'Envoyé à 10 h 58, ouvert à 11 h 02',
  },
  ines: {
    id: 'm-ines',
    recipient: 'Inès Garnier',
    state: 'sent',
    summary: 'Relance, 1 colis FedEx',
    status: 'Envoyé hier à 9 h 00',
  },
} satisfies Record<string, SentEmail>;
