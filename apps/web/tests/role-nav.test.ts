import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  type AccountRole,
  areaOf,
  mayReach,
} from '#/features/auth/route-access';
import {
  accountLine,
  activeDeskEntry,
  DESK_PATH,
  type DeskEntry,
  deskNav,
  roleSpace,
} from '#/features/shell/role-nav';

const t = createTranslator(DEFAULT_LOCALE);
const PROFILE = { shuttleActsAsDepartment: true };

const reachable = (role: AccountRole, path: string) => {
  const area = areaOf(path);
  return area !== null && mayReach(area, role, PROFILE);
};

describe('deskNav', () => {
  it.each(['company_admin', 'department'] as const)(
    'only leads %s where it may go, the directory included',
    (role) => {
      const ids = deskNav(role, t)
        .flatMap((section) => section.items)
        .map((item) => item.id as DeskEntry);
      expect(ids).toContain('annuaire');
      for (const id of ids) {
        expect(reachable(role, DESK_PATH[id])).toBe(true);
      }
    },
  );
});

describe('roleSpace', () => {
  it.each(['company_admin', 'department', 'shuttle', null] as const)(
    'opens a space %s may reach',
    (role) => {
      const space = roleSpace(role, t);
      expect(space && reachable(role, space.to)).toBe(true);
    },
  );

  it('offers the app admin none', () => {
    expect(roleSpace('platform_admin', t)).toBeNull();
  });
});

describe('activeDeskEntry', () => {
  it.each([
    ['/', 'home'],
    ['/tableau-de-bord', 'home'],
    ['/colis', 'colis'],
    ['/colis/abc', 'colis'],
    ['/remise', 'colis'],
    ['/reglages/annuaire', 'annuaire'],
    ['/reglages/compte', 'reglages'],
  ] as const)('marks %s under %s', (path, entry) => {
    expect(activeDeskEntry(path)).toBe(entry);
  });
});

describe('accountLine', () => {
  const names = { company: 'Atelier Lumen', department: 'Studio' };

  it('names the department and the company', () => {
    expect(accountLine('department', names, t)).toBe(
      'Département Studio · Atelier Lumen',
    );
    expect(accountLine('shuttle', names, t)).toBe('Navette · Atelier Lumen');
  });

  it('stays readable offline, without the company', () => {
    expect(accountLine('shuttle', { company: '', department: '' }, t)).toBe(
      'Navette',
    );
  });

  it('says of a role from before the conversion that it awaits the network', () => {
    expect(accountLine(null, { company: '', department: '' }, t)).toBe(
      'À confirmer en ligne',
    );
  });
});

describe('the shuttle without tours', () => {
  it('has no tour to open', () => {
    expect(roleSpace('shuttle', t, false)).toBeNull();
    expect(roleSpace('shuttle', t, true)?.to).toBe('/tournee');
  });
});
