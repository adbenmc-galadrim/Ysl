import type { Person } from '#fixtures/people';

/**
 * A slice of a 312-person directory built at the desk (D15): A to H,
 * enough to show the letter sections of the Annuaire screen.
 */
export const DIRECTORY: Person[] = [
  {
    id: 'u-abernard',
    name: 'Axelle Bernard',
    initials: 'AB',
    department: 'Presse',
  },
  {
    id: 'u-amartin',
    name: 'Antoine Martin',
    initials: 'AM',
    department: 'Studio',
  },
  {
    id: 'u-cmorel',
    name: 'Camille Morel',
    initials: 'CM',
    department: 'Studio',
  },
  {
    id: 'u-crobin',
    name: 'Claire Robin',
    initials: 'CR',
    department: 'Ressources humaines',
  },
  {
    id: 'u-hlefevre',
    name: 'Hugo Lefèvre',
    initials: 'HL',
    department: 'Accessoires',
  },
  {
    id: 'u-hdubois',
    name: 'Hélène Dubois',
    initials: 'HD',
    department: 'Finance',
  },
];

/** The letters of the full directory: nobody under Q, U, W to Z. */
export const DIRECTORY_LETTERS = [...'ABCDEFGHIJKLMNOPRSTV'];
