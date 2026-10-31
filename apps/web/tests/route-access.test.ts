import { readFileSync } from 'node:fs';
import { USER_ROLES } from '@repo/contract/auth';
import { describe, expect, it } from 'vitest';
import {
  type AccountRole,
  areaOf,
  handsOver,
  mayReach,
  needsPreparation,
  type RouteArea,
} from '#/features/auth/route-access';

const ROLES: readonly AccountRole[] = [...USER_ROLES, null];

/** Each area with exactly who reaches it: anyone else reaching it is the bug. */
const EXPECTED: Record<RouteArea, readonly AccountRole[]> = {
  home: ROLES,
  work: ['company_admin', 'department', 'shuttle', null],
  settings: ['company_admin', 'department', 'shuttle', null],
  reception: ['company_admin', 'shuttle', null],
  handover: ['department', 'shuttle', null],
  tour: ['shuttle', null],
  dashboard: ['company_admin'],
  departmentSpace: ['department'],
  directory: ['company_admin', 'department'],
  companySettings: ['company_admin'],
  platform: ['platform_admin'],
};

const ACTS_AS_DEPARTMENT = { shuttleActsAsDepartment: true };
const SHUTTLE_ONLY = { shuttleActsAsDepartment: false };

describe('mayReach', () => {
  it.each(Object.keys(EXPECTED) as RouteArea[])(
    'keeps %s to its roles',
    (area) => {
      const reached = ROLES.filter((role) =>
        mayReach(area, role, ACTS_AS_DEPARTMENT),
      );
      expect(new Set(reached)).toEqual(new Set(EXPECTED[area]));
    },
  );

  it('gives the app admin nothing but its own screen (D26)', () => {
    const areas = (Object.keys(EXPECTED) as RouteArea[]).filter((area) =>
      mayReach(area, 'platform_admin', ACTS_AS_DEPARTMENT),
    );
    expect(areas).toEqual(['home', 'platform']);
  });
});

describe('handsOver', () => {
  it('follows the profile for the shuttle', () => {
    expect(handsOver('shuttle', ACTS_AS_DEPARTMENT)).toBe(true);
    expect(handsOver('shuttle', SHUTTLE_ONLY)).toBe(false);
  });

  it('keeps the handover of a shuttle whose phone has no profile yet', () => {
    expect(handsOver('shuttle', null)).toBe(true);
  });

  it('keeps the handover of a device offline with a role from before the conversion', () => {
    expect(handsOver(null, null)).toBe(true);
    expect(handsOver(null, SHUTTLE_ONLY)).toBe(true);
  });

  it('never gives it to an admin, whatever the profile', () => {
    expect(handsOver('company_admin', ACTS_AS_DEPARTMENT)).toBe(false);
    expect(handsOver('company_admin', null)).toBe(false);
    expect(handsOver('platform_admin', null)).toBe(false);
  });

  it('always gives it to a department', () => {
    expect(handsOver('department', null)).toBe(true);
    expect(handsOver('department', SHUTTLE_ONLY)).toBe(true);
  });
});

describe('needsPreparation', () => {
  it('spares the app admin everywhere, and a computer for the desk roles', () => {
    expect(needsPreparation('platform_admin', false)).toBe(false);
    expect(needsPreparation('platform_admin', true)).toBe(false);
    expect(needsPreparation('department', true)).toBe(false);
    expect(needsPreparation('company_admin', true)).toBe(false);
  });

  it('prepares whoever works on a phone', () => {
    expect(needsPreparation('shuttle', false)).toBe(true);
    expect(needsPreparation('shuttle', true)).toBe(true);
    expect(needsPreparation(null, false)).toBe(true);
    expect(needsPreparation('department', false)).toBe(true);
    expect(needsPreparation('company_admin', false)).toBe(true);
  });
});

describe('areaOf', () => {
  it.each([
    ['/', 'home'],
    ['/scan', 'reception'],
    ['/lot/abc', 'reception'],
    ['/remise', 'handover'],
    ['/remise/confirmee', 'handover'],
    ['/colis/abc/modifier', 'work'],
    ['/reglages', 'settings'],
    ['/reglages/compte', 'settings'],
    ['/reglages/annuaire', 'directory'],
    ['/reglages/fonctionnement', 'companySettings'],
  ] as const)('files %s under %s', (path, area) => {
    expect(areaOf(path)).toBe(area);
  });

  it('leaves a path the app does not have to the router', () => {
    expect(areaOf('/nimporte-quoi')).toBeNull();
    expect(areaOf('/reglages/nouvelle-page')).toBeNull();
    expect(areaOf('/constructor')).toBeNull();
    expect(areaOf('/reglages/constructor')).toBeNull();
  });

  it('knows every signed-in route of the app', () => {
    const tree = readFileSync(
      new URL('../src/app/routeTree.gen.ts', import.meta.url),
      'utf8',
    );
    const block = /interface FileRoutesByTo \{([\s\S]*?)\n\}/.exec(tree)?.[1];
    const paths = [...(block ?? '').matchAll(/'(\/[^']*)':/g)]
      .map(([, path]) => path as string)
      .filter(
        (path) =>
          !['/bienvenue', '/connexion', '/invitation', '/mot-de-passe'].includes(
            path,
          ),
      );
    expect(paths.length).toBeGreaterThan(30);
    expect(paths.filter((path) => areaOf(path) === null)).toEqual([]);
  });
});
