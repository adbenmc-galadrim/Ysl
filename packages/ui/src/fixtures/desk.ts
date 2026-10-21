import type { DesktopNavItem } from '#components/desktop-shell';
import type { ParcelState } from '#fixtures/parcels';

/**
 * The parcels as the desktop table lists them: the full tracking number, who
 * received each one and when — the columns a phone row has no room for.
 */
export type DeskParcel = {
  id: string;
  recipient: string;
  /** The recipient was guessed from the label and needs confirming. */
  uncertain?: boolean;
  department: string;
  carrier: string;
  tracking: string;
  state: ParcelState;
  status: string;
  received: string;
  /** Initials of the agent who scanned it. */
  agent: string;
};

export const DESK_PARCELS: DeskParcel[] = [
  {
    id: 'p-7505',
    recipient: 'Léa Fontaine ?',
    uncertain: true,
    department: 'Presse',
    carrier: 'Colissimo',
    tracking: '8J 02299 07975 0',
    state: 'incomplete',
    status: 'À compléter',
    received: '10:40',
    agent: 'KD',
  },
  {
    id: 'p-0622',
    recipient: 'Camille Morel',
    department: 'Studio',
    carrier: 'UPS',
    tracking: '1Z E63 44W 04 9923 0622',
    state: 'toNotify',
    status: 'À notifier',
    received: '10:42',
    agent: 'KD',
  },
  {
    id: 'p-7112',
    recipient: 'Hugo Lefèvre',
    department: 'Accessoires',
    carrier: 'DHL',
    tracking: '54 1333 7112',
    state: 'notified',
    status: 'Notifié',
    received: '08:51',
    agent: 'SL',
  },
  {
    id: 'p-4471',
    recipient: 'Nora Haddad',
    department: 'Communication',
    carrier: 'Amazon',
    tracking: 'TBA 3011 4471',
    state: 'notified',
    status: 'Notifiée',
    received: '10:15',
    agent: 'SL',
  },
  {
    id: 'p-3338',
    recipient: 'Inès Garnier',
    department: 'Ressources humaines',
    carrier: 'FedEx',
    tracking: '8779 7487 3338',
    state: 'late',
    status: 'En attente 3 j',
    received: 'Lun.',
    agent: 'KD',
  },
  {
    id: 'p-2094',
    recipient: 'Paul Mercier',
    department: 'Juridique',
    carrier: 'DPD',
    tracking: '1046 4000 2094 04',
    state: 'notified',
    status: 'Notifié',
    received: '09:30',
    agent: 'TM',
  },
  {
    id: 'p-31JB',
    recipient: 'Malik Benali',
    department: 'Finance',
    carrier: 'Chronopost',
    tracking: 'HA 9153 0663 1JB',
    state: 'handedOver',
    status: 'Remis',
    received: '09:12',
    agent: 'KD',
  },
  {
    id: 'p-2210',
    recipient: 'Axelle Bernard',
    department: 'Presse',
    carrier: 'UPS',
    tracking: '1Z 88A 21W 04 1188 2210',
    state: 'handedOver',
    status: 'Remis',
    received: '08:40',
    agent: 'SL',
  },
];

/** The phone's sections, in the same order, as the sidebar. */
export const DESK_NAV: DesktopNavItem[] = [
  { id: 'colis', label: 'Colis', icon: 'inbox' },
  { id: 'reception', label: 'Réception', icon: 'scan' },
  { id: 'remise', label: 'Remise', icon: 'qr' },
  { id: 'emails', label: 'E-mails', icon: 'send' },
  { id: 'rapports', label: 'Rapports', icon: 'list' },
  { id: 'annuaire', label: 'Annuaire', icon: 'users' },
  { id: 'reglages', label: 'Réglages', icon: 'menu' },
];
