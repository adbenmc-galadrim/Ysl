/**
 * The pickup e-mails of the demo mailroom: the one Nora receives, and the
 * day's sending log the agent follows. Same cast as `parcels.ts`.
 */

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
  sender: string;
  to: string;
  sentAt: string;
  greeting: string;
  body: string;
  code: string;
  qr: string[];
  parcels: { id: string; label: string; status: string }[];
  place: string;
  hours: string;
  signature: string;
};

export const PICKUP_EMAIL = {
  subject: '2 colis vous attendent au service courrier',
  sender: 'Service courrier',
  to: 'Nora Haddad',
  sentAt: 'aujourd’hui 10:58',
  greeting: 'Bonjour Nora,',
  body: 'Deux colis sont arrivés pour vous. Présentez ce QR code ou donnez le code au comptoir.',
  code: '4821',
  qr: QR_4821,
  parcels: [
    { id: 'p-4471', label: 'Amazon ···4471', status: 'Reçu à 10 h 15' },
    { id: 'p-4472', label: 'Amazon ···4472', status: 'Reçu à 10 h 15' },
  ],
  place: 'Rez-de-chaussée, comptoir courrier',
  hours: 'Lun. au ven., 9 h à 12 h 30 et 14 h à 18 h',
  signature: 'Service courrier, Saint Laurent',
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
