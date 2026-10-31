import { canHandOver, toUserRole } from '@repo/contract/auth';
import {
  DEFAULT_OPERATING_PROFILE,
  operatingImpact,
  parseOperatingProfile,
  reminderMode,
  SMALL_SITE_OPERATING_PROFILE,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import { describe, expect, it } from 'vitest';

const COUNTS = {
  a_completer: 3,
  recu: 5,
  en_route: 4,
  depose: 2,
  a_regulariser: 6,
  notifie: 7,
  remis: 100,
  retourne: 9,
};

const impactOf = (change: Partial<OperatingProfile>) =>
  operatingImpact(
    DEFAULT_OPERATING_PROFILE,
    { ...DEFAULT_OPERATING_PROFILE, ...change },
    COUNTS,
  );

describe('toUserRole', () => {
  it('gives nothing for a role this version does not know, or a null one', () => {
    expect(toUserRole('company_admin')).toBe('company_admin');
    for (const role of ['admin', 'agent', 'autre', null, undefined]) {
      expect(toUserRole(role)).toBeNull();
    }
  });
});

describe('canHandOver', () => {
  it('keeps the shuttle from handing over without a profile saying so', () => {
    expect(canHandOver('shuttle', DEFAULT_OPERATING_PROFILE)).toBe(false);
    expect(canHandOver('shuttle', SMALL_SITE_OPERATING_PROFILE)).toBe(true);
  });

  it('lets a department hand over whatever the profile', () => {
    expect(canHandOver('department', DEFAULT_OPERATING_PROFILE)).toBe(true);
    expect(canHandOver('department', SMALL_SITE_OPERATING_PROFILE)).toBe(true);
  });

  it.each(['company_admin', 'platform_admin'] as const)(
    'never lets %s hand over',
    (role) => {
      expect(canHandOver(role, SMALL_SITE_OPERATING_PROFILE)).toBe(false);
    },
  );
});

describe('parseOperatingProfile', () => {
  it('falls back to the default on nothing or an unreadable value', () => {
    expect(parseOperatingProfile(undefined)).toEqual(DEFAULT_OPERATING_PROFILE);
    expect(
      parseOperatingProfile({ ...DEFAULT_OPERATING_PROFILE, photo: 'maybe' }),
    ).toEqual(DEFAULT_OPERATING_PROFILE);
  });

  it('keeps what it knows of a later version', () => {
    expect(
      parseOperatingProfile({ ...SMALL_SITE_OPERATING_PROFILE, later: true }),
    ).toEqual(SMALL_SITE_OPERATING_PROFILE);
  });
});

describe('reminderMode', () => {
  it('reads the three states as none, by hand, automatic', () => {
    expect(reminderMode('disabled')).toBe('none');
    expect(reminderMode('optional')).toBe('manual');
    expect(reminderMode('required')).toBe('automatic');
  });
});

describe('operatingImpact on the parcels under way', () => {
  it.each([
    ['shuttleActsAsDepartment', { shuttleActsAsDepartment: true }, 18],
    ['batchReview', { batchReview: 'required' }, 3],
    ['depositConfirmation', { depositConfirmation: 'count' }, 4],
    ['handoverProof', { handoverProof: 'required' }, 14],
    ['handoverScan', { handoverScan: 'required' }, 14],
    ['signature', { signature: 'required' }, 14],
    ['photo', { photo: 'disabled' }, 14],
    ['emailMoment', { emailMoment: 'deposit' }, 6],
    ['reminders', { reminders: 'required' }, 7],
  ] satisfies [string, Partial<OperatingProfile>, number][])(
    '%s touches its parcels, never those already handed over or returned',
    (param, change, parcels) => {
      const impact = impactOf(change);
      expect(impact.changes).toEqual([
        expect.objectContaining({ param, parcels }),
      ]);
      expect(impact.parcels).toBe(parcels);
    },
  );

  it('counts a parcel once when several changes touch it', () => {
    const impact = impactOf({
      signature: 'required',
      photo: 'required',
      reminders: 'disabled',
    });
    expect(impact.changes.map((change) => change.parcels)).toEqual([14, 14, 7]);
    expect(impact.parcels).toBe(14);
  });

  it('adds up parcels at different stages', () => {
    expect(
      impactOf({ batchReview: 'disabled', signature: 'required' }).parcels,
    ).toBe(17);
  });

  it('finds nothing when nothing changed', () => {
    expect(impactOf({})).toEqual({ changes: [], parcels: 0 });
  });
});
