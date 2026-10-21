/**
 * The people of the demo mailroom: the agents who run the desk, and the
 * employees parcels are for and who may collect them. Names match the
 * recipients of `parcels.ts`.
 */
export type Agent = {
  id: string;
  name: string;
  initials: string;
};

export const AGENTS = {
  karim: { id: 'a-kdaoud', name: 'Karim Daoud', initials: 'KD' },
} satisfies Record<string, Agent>;

export type Person = {
  id: string;
  name: string;
  initials: string;
  department: string;
};

export const PEOPLE = {
  nora: {
    id: 'u-nhaddad',
    name: 'Nora Haddad',
    initials: 'NH',
    department: 'Communication',
  },
  noe: { id: 'u-nbertin', name: 'Noé Bertin', initials: 'NB', department: 'Studio' },
  noemie: {
    id: 'u-nlaurent',
    name: 'Noémie Laurent',
    initials: 'NL',
    department: 'Finance',
  },
  paul: {
    id: 'u-pmercier',
    name: 'Paul Mercier',
    initials: 'PM',
    department: 'Juridique',
  },
  malik: {
    id: 'u-mbenali',
    name: 'Malik Benali',
    initials: 'MB',
    department: 'Finance',
  },
} satisfies Record<string, Person>;
