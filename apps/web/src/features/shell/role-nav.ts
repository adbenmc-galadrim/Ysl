import type { TranslateFn } from '@repo/shared/i18n';
import type { CompanyShellNavSection, IconName } from '@repo/ui';
import type { AccountRole } from '#/features/auth/route-access';

export type DeskEntry = 'home' | 'colis' | 'annuaire' | 'comptes' | 'reglages';

/** Where each entry of the computer's sidebar leads. */
export const DESK_PATH = {
  home: '/',
  colis: '/colis',
  annuaire: '/reglages/annuaire',
  comptes: '/reglages/comptes',
  reglages: '/reglages',
} as const satisfies Record<DeskEntry, string>;

/**
 * The sidebar of the two computer roles (D23), limited to what exists: the
 * mockups' deposits and reports join it with their tickets.
 */
export function deskNav(
  role: AccountRole,
  t: TranslateFn,
): CompanyShellNavSection[] {
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
        { id: 'annuaire', label: t('directory.nav.directory'), icon: 'users' },
        ...(role === 'company_admin'
          ? [{ id: 'comptes', label: t('accounts.title'), icon: 'key' } as const]
          : []),
        { id: 'reglages', label: t('directory.nav.settings'), icon: 'sliders' },
      ],
    },
  ];
}

const SPACE_PATHS = ['/tableau-de-bord', '/departement'];

/** The entry a path belongs to; a parcel's record stays under Colis. */
export function activeDeskEntry(pathname: string): DeskEntry {
  if (pathname === '/' || SPACE_PATHS.includes(pathname)) return 'home';
  if (pathname.startsWith(DESK_PATH.annuaire)) return 'annuaire';
  if (pathname.startsWith(DESK_PATH.comptes)) return 'comptes';
  if (pathname.startsWith(DESK_PATH.reglages)) return 'reglages';
  return 'colis';
}

/** The pages drawn for a computer; every other one is a phone screen in the frame. */
export const isDeskPage = (pathname: string): boolean =>
  pathname === '/' || SPACE_PATHS.includes(pathname);

export type RoleSpace = {
  to: '/tournee' | '/departement' | '/tableau-de-bord';
  icon: IconName;
  label: string;
};

/** On the phone, Colis stays the home: the role's own space opens from Réglages. */
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
    case 'department':
      return {
        to: '/departement',
        icon: 'inbox',
        label: t('home.department.title'),
      };
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
