import type { Agent } from '#fixtures/people';

/**
 * The mailroom team as the "Équipe et postes" screen lists it: who is an
 * admin, which device each one works on, who is connected right now.
 */
export type TeamMember = Agent & {
  role: 'Administrateur' | 'Agent';
  /** As the screen words it: "iPhone du service", "ordinateur de l’accueil". */
  device: string;
  online: boolean;
};

export const TEAM = {
  karim: {
    id: 'a-kdaoud',
    name: 'Karim Daoud',
    initials: 'KD',
    role: 'Administrateur',
    device: 'iPhone du service',
    online: true,
  },
  sophie: {
    id: 'a-slambert',
    name: 'Sophie Lambert',
    initials: 'SL',
    role: 'Agent',
    device: 'iPhone personnel',
    online: true,
  },
  thomas: {
    id: 'a-tmoreau',
    name: 'Thomas Moreau',
    initials: 'TM',
    role: 'Agent',
    device: 'ordinateur de l’accueil',
    online: false,
  },
} satisfies Record<string, TeamMember>;
