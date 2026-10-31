import { canHandOver } from '@repo/contract/auth';
import {
  DEFAULT_OPERATING_PROFILE,
  operatingImpact,
  parseOperatingProfile,
  reminderMode,
  SMALL_SITE_OPERATING_PROFILE,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import { describe, expect, it } from 'vitest';

const COUNTS = { a_completer: 3, recu: 5, notifie: 7, remis: 100, retourne: 9 };

const impactOf = (change: Partial<OperatingProfile>) =>
  operatingImpact(
    DEFAULT_OPERATING_PROFILE,
    { ...DEFAULT_OPERATING_PROFILE, ...change },
    COUNTS,
  );

describe('canHandOver', () => {
  it('keeps the shuttle from handing over without a profile saying so', () => {
    expect(canHandOver('shuttle', DEFAULT_OPERATING_PROFILE)).toBe(false);
    expect(canHandOver('shuttle', SMALL_SITE_OPERATING_PROFILE)).toBe(true);
  });

  it.each(['admin', 'agent', 'department'] as const)(
    'leaves %s as it was whatever the profile',
    (role) => {
      expect(canHandOver(role, DEFAULT_OPERATING_PROFILE)).toBe(true);
      expect(canHandOver(role, SMALL_SITE_OPERATING_PROFILE)).toBe(true);
    },
  );

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
    ['shuttleActsAsDepartment', { shuttleActsAsDepartment: true }, 12],
    ['batchReview', { batchReview: 'required' }, 3],
    ['depositConfirmation', { depositConfirmation: 'count' }, 0],
    ['handoverProof', { handoverProof: 'required' }, 12],
    ['handoverScan', { handoverScan: 'required' }, 12],
    ['signature', { signature: 'required' }, 12],
    ['photo', { photo: 'disabled' }, 12],
    ['emailMoment', { emailMoment: 'deposit' }, 0],
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
    expect(impact.changes.map((change) => change.parcels)).toEqual([12, 12, 7]);
    expect(impact.parcels).toBe(12);
  });

  it('adds up parcels at different stages', () => {
    expect(
      impactOf({ batchReview: 'disabled', signature: 'required' }).parcels,
    ).toBe(15);
  });

  it('finds nothing when nothing changed', () => {
    expect(impactOf({})).toEqual({ changes: [], parcels: 0 });
  });
});
