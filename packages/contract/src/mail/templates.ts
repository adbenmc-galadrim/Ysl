import type { MailVariable } from './render';

/** What an e-mail is for: the first notice, a reminder, the service's summary. */
export const NOTIFICATION_TYPES = [
  'avis',
  'relance',
  'resume_service',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_SUBJECT_MAX = 200;
export const TEMPLATE_BODY_MAX = 100_000;

/**
 * The longest body S5 opened and received whole, in Mail and in Outlook
 * (100 000 characters, a 300 075-character URL): past it, nobody knows.
 */
export const MAIL_BODY_TESTED_MAX = 100_000;

export type TemplateText = { name: string; subject: string; body: string };

/**
 * The template every agent starts with (§8.7, maquette « E-mail reçu par le
 * salarié », 06 · Notification) as plain text, S5 having shown that a
 * `mailto:` carries nothing else: the pickup code first and in clear, one
 * bullet per parcel, where and when, and a plain "reply to this mail" rather
 * than links Mail shows encoded. Signed by the agent for the mailroom,
 * without the house's name (D14); the QR goes with the share sheet.
 */
export const DEFAULT_TEMPLATES = {
  avis: {
    name: 'Avis de retrait',
    subject: '{nombre_colis} en attente de retrait – Service Courrier',
    body: [
      'Bonjour {prénom},',
      '',
      'Votre code de retrait : {code}',
      '',
      'Nous avons reçu pour vous :',
      '{colis}',
      '{reserve}',
      '',
      'Où : {lieu}',
      'Quand : {horaires}',
      '{consignes}',
      '',
      'Donnez votre code au comptoir du service courrier. Un colis n’est pas pour vous, ou un collègue passera à votre place ? Répondez simplement à ce mail.',
      '',
      '{agent}',
      'Service Courrier',
    ].join('\n'),
  },
} as const satisfies Partial<Record<NotificationType, TemplateText>>;

export type DefaultTemplateType = keyof typeof DEFAULT_TEMPLATES;

/**
 * The id of the template an agent starts with, the same on every iPhone and
 * on the server: two iPhones that each save it write the same row, never a
 * second one, and the server knows it to keep it from being deleted. Shaped
 * as a UUID v7, as every id is.
 */
export async function presetTemplateId(
  ownerId: string,
  type: string,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`email_template:default:${ownerId}:${type}`),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x70;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10, 16),
  ]
    .map((part) => part.join(''))
    .join('-');
}

/** The parcel and person every preview renders: the ones of the maquette. */
export const SAMPLE_MAIL = {
  firstName: 'Nora',
  lastName: 'Haddad',
  code: '4821',
  parcels: ['Amazon ···4471, reçu à 10 h 15', 'Amazon ···4472, reçu à 10 h 15'],
} as const;

export const SAMPLE_PICKUP_VALUES = {
  lieu: 'Rez-de-chaussée, comptoir courrier',
  horaires: 'Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
  consignes: '',
} as const satisfies Partial<Record<MailVariable, string>>;
