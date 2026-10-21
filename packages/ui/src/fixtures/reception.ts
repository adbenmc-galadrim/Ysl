import { PARCELS, type Parcel } from '#fixtures/parcels';
import { PEOPLE, type Person } from '#fixtures/people';

/**
 * The reception burst of 10 h 31: twelve parcels scanned in a row, two of
 * which the scanner could not settle on its own. Same cast as `parcels.ts`,
 * so the batch review and the home list tell the same story.
 */

/** A directory entry as the recipient picker shows it. */
export type DirectoryEntry = Person & {
  /** Floor, after the department: "Presse, 3e étage". */
  floor?: string;
  /** Cut short in the list; the agent only needs to tell homonyms apart. */
  email?: string;
};

export const DIRECTORY = {
  lea: {
    id: 'u-lfontaine',
    name: 'Léa Fontaine',
    initials: 'LF',
    department: 'Presse',
    floor: '3e étage',
    email: 'lea.fontaine@…',
  },
  louis: {
    id: 'u-lofontaine',
    name: 'Louis Fontaine',
    initials: 'LF',
    department: 'Studio',
    floor: '2e étage',
    email: 'louis.fontaine@…',
  },
  lise: {
    id: 'u-lfontan',
    name: 'Lise Fontan',
    initials: 'LF',
    department: 'Finance',
    floor: '5e étage',
    email: 'lise.fontan@…',
  },
  nora: PEOPLE.nora,
  hugo: {
    id: 'u-hlefevre',
    name: 'Hugo Lefèvre',
    initials: 'HL',
    department: 'Accessoires',
  },
} satisfies Record<string, DirectoryEntry>;

/** "Presse, 3e étage" — department, then floor when known. */
export const whereabouts = (entry: DirectoryEntry) =>
  entry.floor ? `${entry.department}, ${entry.floor}` : entry.department;

/** What the label the camera is pointed at says. */
export const SCANNED_LABEL = {
  carrier: 'UPS',
  recipient: 'Camille Morel',
  address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS FR'],
  tracking: '1Z E63 44W 04 9923 0622',
};

/** The Colissimo label whose name the glare cut: "L. FONTAIN…". */
export const UNCERTAIN_LABEL = {
  heading: 'Destinataire :',
  name: 'L. FONTAIN',
  address: ['SAINT LAURENT, 37 RUE DE BELLECHASSE', '75007 PARIS'],
  carrier: 'Colissimo',
  tracking: '8J 02299 07975 0',
};

export const PAUL_DPD: Parcel = {
  id: 'p-9404',
  recipient: PEOPLE.paul.name,
  department: PEOPLE.paul.department,
  carrier: 'DPD',
  last4: '9404',
  state: 'toNotify',
  status: 'Reçu à 10 h 47',
};

/** The batch once the burst is over, as the review screen splits it. */
export const RECEPTION_BATCH = {
  count: 12,
  startedAt: '10 h 31',
  endedAt: '10 h 52',
  /** Parcels the scanner flagged, with what it could read. */
  toCheck: [
    {
      parcel: PARCELS.unknown,
      issue: 'Destinataire incertain',
      lines: ['Colissimo ···7505', 'Lu : « L. FONTAIN »'],
    },
    {
      parcel: PARCELS.camille,
      issue: 'Numéro de suivi incomplet',
      lines: ['UPS 1Z E63 44W 04 99…'],
    },
  ],
  /** The first ready ones; the screen shows four of the ten. */
  ready: [PARCELS.hugo, PARCELS.nora, PAUL_DPD, PARCELS.ines],
  readyCount: 10,
};
