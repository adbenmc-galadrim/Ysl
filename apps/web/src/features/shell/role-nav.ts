import type { TranslateFn } from '@repo/shared/i18n';
import type { CompanyShellNavSection, IconName } from '@repo/ui';
import type { AccountRole } from '#/features/auth/route-access';

export type DeskEntry =
  | 'home'
  | 'colis'
  | 'depots'
  | 'regulariser'
  | 'annuaire'
  | 'comptes'
  | 'rapports'
  | 'emails'
  | 'mine'
  | 'reglages';

/** Where each entry of the computer's sidebar leads. */
export const DESK_PATH = {
  home: '/',
  colis: '/colis',
  depots: '/departement/depots',
  regulariser: '/tableau-de-bord/regulariser',
  annuaire: '/reglages/annuaire',
  comptes: '/reglages/comptes',
  rapports: '/rapports',
  emails: '/reglages/e-mails',
  mine: '/departement/lieu',
  reglages: '/reglages',
} as const satisfies Record<DeskEntry, string>;

export type DepartmentNav = {
  name: string;
  present?: number;
  toConfirm?: number;
  people?: number;
};

/** The department's sidebar (maquette 03), with Réglages for leaving the account. */
function departmentNav(
  t: TranslateFn,
  { name, present, toConfirm, people }: DepartmentNav,
): CompanyShellNavSection[] {
  return [
    {
      items: [
        {
          id: 'colis',
          label: t('directory.nav.parcels'),
          icon: 'package',
          count: present,
        },
        {
          id: 'depots',
          label: t('departmentSpace.nav.depots'),
          icon: 'truck',
          count: toConfirm || undefined,
          countTone: 'orange',
        },
        {
          id: 'annuaire',
          label: t('directory.nav.directory'),
          icon: 'users',
          count: people,
        },
        { id: 'emails', label: t('departmentSpace.nav.emails'), icon: 'send' },
      ],
    },
    {
      title: name.toLocaleUpperCase('fr'),
      items: [
        { id: 'mine', label: t('departmentSpace.nav.mine'), icon: 'building' },
        { id: 'reglages', label: t('directory.nav.settings'), icon: 'sliders' },
      ],
    },
  ];
}

/**
 * The sidebar of the two computer roles (D23), limited to what exists.
 */
export function deskNav(
  role: AccountRole,
  t: TranslateFn,
  department: DepartmentNav = { name: '' },
): CompanyShellNavSection[] {
  if (role === 'department') return departmentNav(t, department);
  const home =
    role === 'company_admin'
      ? ({
          label: t('shell.nav.dashboard'),
          icon: 'dashboard',
        } as const)
      : ({ label: t('shell.nav.home'), icon: 'inbox' } as const);
  return [
    {
      items: [
        { id: 'home', ...home },
        { id: 'colis', label: t('directory.nav.parcels'), icon: 'package' },
        ...(role === 'company_admin'
          ? [
              {
                id: 'regulariser',
                label: t('settlement.title'),
                icon: 'alert',
              } as const,
            ]
          : []),
        { id: 'annuaire', label: t('directory.nav.directory'), icon: 'users' },
        ...(role === 'company_admin'
          ? [
              {
                id: 'comptes',
                label: t('accounts.title'),
                icon: 'key',
              } as const,
              {
                id: 'rapports',
                label: t('reports.title'),
                icon: 'chart',
              } as const,
            ]
          : []),
        { id: 'reglages', label: t('directory.nav.settings'), icon: 'sliders' },
      ],
    },
  ];
}

const SPACE_PATHS = ['/tableau-de-bord'];

/** The entry a path belongs to; a parcel's record stays under Colis. */
export function activeDeskEntry(
  pathname: string,
  role?: AccountRole,
): DeskEntry {
  if (pathname === '/' || SPACE_PATHS.includes(pathname)) {
    return role === 'department' ? 'colis' : 'home';
  }
  if (pathname.startsWith(DESK_PATH.mine)) return 'mine';
  if (role === 'department' && pathname.startsWith(DESK_PATH.emails)) {
    return 'emails';
  }
  if (pathname.startsWith(DESK_PATH.depots)) return 'depots';
  if (pathname.startsWith(DESK_PATH.regulariser)) return 'regulariser';
  if (pathname.startsWith(DESK_PATH.annuaire)) return 'annuaire';
  if (pathname.startsWith(DESK_PATH.comptes)) return 'comptes';
  if (pathname.startsWith(DESK_PATH.rapports)) return 'rapports';
  if (pathname.startsWith(DESK_PATH.reglages)) return 'reglages';
  return 'colis';
}

/** The pages drawn for a computer; every other one is a phone screen in the frame. */
export const isDeskPage = (pathname: string): boolean =>
  pathname === '/' ||
  SPACE_PATHS.includes(pathname) ||
  pathname === DESK_PATH.depots ||
  pathname === DESK_PATH.mine ||
  pathname === DESK_PATH.rapports ||
  pathname === DESK_PATH.regulariser;

export type RoleSpace = {
  to: '/tournee' | '/tableau-de-bord';
  icon: IconName;
  label: string;
};

/** The role's own space, opened from Réglages on the phone. A shuttle on tour also opens on it (`HomePage`). */
export function roleSpace(
  role: AccountRole,
  t: TranslateFn,
  /** The company runs tours: no tour to open otherwise. */
  tour = true,
): RoleSpace | null {
  switch (role) {
    case 'company_admin':
      return {
        to: '/tableau-de-bord',
        icon: 'dashboard',
        label: t('shell.nav.dashboard'),
      };
    // Its Colis is its space, and its place sits in Réglages.
    case 'department':
    case 'platform_admin':
      return null;
    default:
      return tour
        ? { to: '/tournee', icon: 'truck', label: t('home.tour.title') }
        : null;
  }
}

/** Who the account is, one line: « Département Studio · Atelier Lumen ». */
export function accountLine(
  role: AccountRole,
  { company, department }: { company: string; department: string },
  t: TranslateFn,
): string {
  const who = role ? t(`auth.role.${role}`) : t('auth.role.unknown');
  const named =
    role === 'department' && department ? `${who} ${department}` : who;
  return company ? `${named} · ${company}` : named;
}
