/**
 * The handover of the demo mailroom: Nora Haddad collecting her three
 * parcels, as the Remise screens show them.
 */

/** Modules of the QR on the employee's phone, as drawn in the scan mockup. */
export const QR_4821_PHONE = [
  '####..#..###',
  '###......###',
  '###..#..####',
  '#..#..#..#..',
  '............',
  '..#..#..#..#',
  '#..#..#..#..',
  '............',
  '..#..#..#..#',
  '####..#..#..',
  '###.........',
  '###..#..#..#',
];

export type HandoverParcel = {
  id: string;
  carrier: string;
  last4: string;
  received: string;
  /** Registered mail: the handover asks for a signature. */
  registered?: boolean;
};

export const NORA_HANDOVER: HandoverParcel[] = [
  { id: 'p-4471', carrier: 'Amazon', last4: '4471', received: 'Reçu aujourd’hui à 10 h 15' },
  { id: 'p-4472', carrier: 'Amazon', last4: '4472', received: 'Reçu aujourd’hui à 10 h 15' },
  { id: 'p-8810', carrier: 'UPS', last4: '8810', received: 'Reçu hier', registered: true },
];
