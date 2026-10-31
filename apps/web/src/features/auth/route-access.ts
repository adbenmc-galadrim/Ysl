import {
  canHandOver,
  isCompanyAdmin,
  type UserRole,
} from '@repo/contract/auth';
import type { OperatingProfile } from '@repo/contract/operating-profile';

/**
 * What the app knows of an account: its role, or `null` for one this version
 * does not know, such as the `agent` or `admin` a device kept from before the
 * conversion. Offline it cannot ask, and the work on the phone must go on: it
 * keeps the agent's field work, and the server decides once it is back.
 */
export type AccountRole = UserRole | null;

/** Everything a route can be, by who may open it. */
export type RouteArea =
  | 'home'
  | 'work'
  | 'reception'
  | 'handover'
  | 'tour'
  | 'dashboard'
  | 'departmentSpace'
  | 'directory'
  | 'companySettings'
  | 'platform'
  | 'settings';

const AREA_OF_FIRST_SEGMENT = new Map<string, RouteArea>(
  Object.entries({
    colis: 'work',
    notifier: 'work',
    preparation: 'work',
    recherche: 'work',
    relances: 'work',
    scan: 'reception',
    revue: 'reception',
    lot: 'reception',
    remise: 'handover',
    tournee: 'tour',
    'tableau-de-bord': 'dashboard',
    departement: 'departmentSpace',
    entreprises: 'platform',
    reglages: 'settings',
  }),
);

/** One line per page: a page of Réglages left out is refused nothing, so a test requires it. */
const AREA_OF_SETTING = new Map<string, RouteArea>(
  Object.entries({
    apparence: 'settings',
    arrondis: 'settings',
    compte: 'settings',
    'e-mails': 'settings',
    export: 'settings',
    messagerie: 'settings',
    'modeles-email': 'settings',
    remises: 'settings',
    synchronisation: 'settings',
    annuaire: 'directory',
    appareils: 'companySettings',
    comptes: 'companySettings',
    donnees: 'companySettings',
    expediteur: 'companySettings',
    fonctionnement: 'companySettings',
    'import-v1': 'companySettings',
    'lieu-et-horaires': 'companySettings',
  }),
);

/** Null for a path the app does not have: the router answers it. */
export function areaOf(pathname: string): RouteArea | null {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (!first) return 'home';
  if (first === 'reglages' && second) {
    return AREA_OF_SETTING.get(second) ?? null;
  }
  return AREA_OF_FIRST_SEGMENT.get(first) ?? null;
}

const FIELD: readonly AccountRole[] = [
  'shuttle',
  'department',
  'company_admin',
  null,
];

const REACHED_BY: Record<
  Exclude<RouteArea, 'home' | 'handover'>,
  readonly AccountRole[]
> = {
  work: FIELD,
  settings: FIELD,
  // §2.1 gives reception to the shuttle. The server still takes it from the
  // company admin, who may have a batch open on an iPhone since the conversion.
  reception: ['shuttle', 'company_admin', null],
  tour: ['shuttle', null],
  dashboard: ['company_admin'],
  departmentSpace: ['department'],
  directory: ['department', 'company_admin'],
  companySettings: ['company_admin'],
  platform: ['platform_admin'],
};

/**
 * Gives a parcel to an employee, as far as this device can tell. A shuttle
 * with no profile on the phone has not pulled it yet: it keeps the handover
 * rather than losing a day's work, and the server has the last word.
 */
export function handsOver(
  role: AccountRole,
  profile: Pick<OperatingProfile, 'shuttleActsAsDepartment'> | null,
): boolean {
  if (role === null) return true;
  if (role === 'shuttle' && profile === null) return true;
  return canHandOver(role, profile ?? { shuttleActsAsDepartment: false });
}

/** Scans labels in: the home's main button, its batches and their learning. */
export const receives = (role: AccountRole): boolean =>
  REACHED_BY.reception.includes(role);

export function mayReach(
  area: RouteArea,
  role: AccountRole,
  profile: Pick<OperatingProfile, 'shuttleActsAsDepartment'> | null,
): boolean {
  if (area === 'home') return true;
  if (area === 'handover') return handsOver(role, profile);
  return REACHED_BY[area].includes(role);
}

/** Has the computer layout (D23); the phone keeps the working screens. */
export const hasDesk = (role: AccountRole): boolean =>
  role === 'department' || isCompanyAdmin(role);

/**
 * The offline preparation serves whoever works on a phone. The app's admin has
 * no parcels (D26), and a computer has no label to read.
 */
export function needsPreparation(role: AccountRole, desk: boolean): boolean {
  if (role === 'platform_admin') return false;
  return !(desk && hasDesk(role));
}
