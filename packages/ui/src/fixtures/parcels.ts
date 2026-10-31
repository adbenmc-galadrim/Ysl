/**
 * The demo mailroom every screen story draws from: one shared cast, so the
 * same parcel reads the same on the list, its record and the handover.
 */

export type ParcelState =
  /** The scan left a question: unknown recipient, unreadable number. */
  | 'incomplete'
  /** Received and stored, the recipient does not know yet. */
  | 'toNotify'
  /** With the shuttle in a company that runs tours, not on its way yet: nobody to tell (§3.7.6). */
  | 'toDispatch'
  /** With the shuttle, on its way to its department (§3.7.6). */
  | 'onTour'
  /** At its department, the recipient not told yet. */
  | 'deposited'
  /** A gap at the deposit, or its recipient moved: the admin reassigns it (ME28). */
  | 'toSettle'
  /** Notified, waiting for the recipient to come by. */
  | 'notified'
  /** Notified long enough ago that it needs chasing. */
  | 'late'
  | 'handedOver'
  /** Sent back to the sender: nothing left to do, found by the search. */
  | 'returned';

export type Parcel = {
  id: string;
  recipient: string;
  department: string;
  carrier: string;
  /** Last four characters of the tracking number, as read aloud at the desk. */
  last4: string;
  state: ParcelState;
  /** Free text of the state line: "Reçu à 10 h 42", "Notifié il y a 2 h". */
  status: string;
  /** Overrides the "department, carrier ···last4" line when set. */
  detail?: string;
  /** A second state line, shown in the state colour. */
  note?: string;
  /** Draws the note in orange: something to do, e.g. « Sans e-mail ». */
  noteTone?: 'orange';
  /** The reserve on the parcel's state, in orange under the detail line: "Réserve · Carton abîmé". */
  damage?: string;
  /**
   * The recipient answered the notification e-mail: "not mine" puts the
   * parcel back in the agent's hands, "a colleague will come" and "away
   * until" just inform.
   */
  reply?: { kind: 'notMine' | 'delegated' | 'absent'; text: string };
  /** Record fields, shown on the parcel screen and its edit form. */
  tracking?: string;
  sender?: string;
  pieces?: number;
  shelf?: string;
  /** Where the recipient sits, under their name on the record. */
  place?: string;
};

export const PARCELS = {
  unknown: {
    id: 'p-7505',
    recipient: 'Destinataire inconnu',
    department: '',
    carrier: 'Colissimo',
    last4: '7505',
    state: 'incomplete',
    status: '',
    detail: 'Colissimo ···7505',
    note: 'Nom lu sur l’étiquette : L. FONTAIN',
  },
  camille: {
    id: 'p-0622',
    recipient: 'Camille Morel',
    department: 'Studio',
    carrier: 'UPS',
    last4: '0622',
    state: 'toNotify',
    status: 'Reçu à 10 h 42',
    tracking: '1Z E63 44W 04 9923 0622',
    sender: 'Metalworks SpA',
    pieces: 1,
    shelf: 'Étagère B',
    place: 'Studio, 2e étage',
  },
  ines: {
    id: 'p-3338',
    recipient: 'Inès Garnier',
    department: 'Ressources humaines',
    carrier: 'FedEx',
    last4: '3338',
    state: 'late',
    status: 'En attente depuis 3 jours, relancée hier',
  },
  hugo: {
    id: 'p-7112',
    recipient: 'Hugo Lefèvre',
    department: 'Accessoires',
    carrier: 'DHL',
    last4: '7112',
    state: 'notified',
    status: 'Notifié il y a 2 h',
  },
  nora: {
    id: 'p-4471',
    recipient: 'Nora Haddad',
    department: 'Communication',
    carrier: 'Amazon',
    last4: '4471',
    state: 'notified',
    status: 'Notifiée il y a 25 min',
    detail: 'Communication, 3 colis Amazon',
  },
  malik: {
    id: 'p-31JB',
    recipient: 'Malik Benali',
    department: 'Finance',
    carrier: 'Chronopost',
    last4: '31JB',
    state: 'handedOver',
    status: 'Remis à 9 h 12',
  },
  /** Search for "garn": Inès's older parcels and a namesake. */
  inesFedex: {
    id: 'p-1209',
    recipient: 'Inès Garnier',
    department: 'Ressources humaines',
    carrier: 'FedEx',
    last4: '1209',
    state: 'handedOver',
    status: 'Remis le 14 oct. à 12 h 05',
    detail: 'FedEx ···1209',
  },
  inesAmazon: {
    id: 'p-5580',
    recipient: 'Inès Garnier',
    department: 'Ressources humaines',
    carrier: 'Amazon',
    last4: '5580',
    state: 'handedOver',
    status: 'Remis le 2 oct. à 9 h 40',
    detail: 'Amazon ···5580',
  },
  romain: {
    id: 'p-7731',
    recipient: 'Romain Garnier',
    department: 'Logistique',
    carrier: 'UPS',
    last4: '7731',
    state: 'handedOver',
    status: 'Remis le 28 sept. à 17 h 12',
    detail: 'UPS ···7731',
  },
  /** Replies to the notification e-mail. */
  hugoNotMine: {
    id: 'p-7112-r',
    recipient: 'Hugo Lefèvre',
    department: 'Accessoires',
    carrier: 'DHL',
    last4: '7112',
    state: 'notified',
    status: 'Notifié il y a 2 h',
    detail: 'DHL ···7112',
    reply: {
      kind: 'notMine',
      text: '« Ce n’est pas pour moi », il y a 10 min',
    },
  },
  noraDelegated: {
    id: 'p-4471-r',
    recipient: 'Nora Haddad',
    department: 'Communication',
    carrier: 'Amazon',
    last4: '4471',
    state: 'notified',
    status: 'Notifiée il y a 25 min',
    detail: '2 colis Amazon',
    reply: { kind: 'delegated', text: 'Paul Mercier passera à sa place' },
  },
  /** Not in the directory: no e-mail to notify him with. */
  marc: {
    id: 'p-9004',
    recipient: 'Marc Petit',
    department: 'Hors annuaire',
    carrier: 'La Poste',
    last4: '9004',
    state: 'toNotify',
    status: 'Reçu à 11 h 05',
    place: 'Hors annuaire, prestataire au 4e étage',
  },
} satisfies Record<string, Parcel>;
