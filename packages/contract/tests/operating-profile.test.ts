import { canHandOver, toUserRole } from '@repo/contract/auth';
import {
  DEFAULT_OPERATING_PROFILE,
  operatingImpact,
  operatingProfile,
  PROFILE_MODELS,
  PROFILE_OF_MODEL,
  parseOperatingProfile,
  reminderMode,
  SMALL_SITE_OPERATING_PROFILE,
  stepsChangedFromModel,
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

describe('profile models', () => {
  it('gives each model the profile of ME18 and of its card', () => {
    expect(PROFILE_OF_MODEL).toEqual({
      small_site: {
        shuttleActsAsDepartment: true,
        batchReview: 'optional',
        depositConfirmation: 'disabled',
        handoverProof: 'optional',
        handoverScan: 'disabled',
        signature: 'optional',
        photo: 'optional',
        emailMoment: 'scan',
        reminders: 'optional',
      },
      multi_departments: {
        shuttleActsAsDepartment: false,
        batchReview: 'optional',
        depositConfirmation: 'count',
        handoverProof: 'required',
        handoverScan: 'optional',
        signature: 'optional',
        photo: 'disabled',
        emailMoment: 'deposit',
        reminders: 'required',
      },
      strict_traceability: {
        shuttleActsAsDepartment: false,
        batchReview: 'required',
        depositConfirmation: 'each',
        handoverProof: 'required',
        handoverScan: 'required',
        signature: 'required',
        photo: 'optional',
        emailMoment: 'deposit',
        reminders: 'required',
      },
    });
  });

  it('writes only complete profiles', () => {
    for (const model of PROFILE_MODELS) {
      expect(operatingProfile.safeParse(PROFILE_OF_MODEL[model]).success).toBe(
        true,
      );
    }
  });

  it('sends only the small site without a tour: its shuttle hands over, the others do not', () => {
    expect(canHandOver('shuttle', PROFILE_OF_MODEL.small_site)).toBe(true);
    expect(canHandOver('shuttle', PROFILE_OF_MODEL.multi_departments)).toBe(
      false,
    );
    expect(canHandOver('shuttle', PROFILE_OF_MODEL.strict_traceability)).toBe(
      false,
    );
  });

  it('counts the steps moved away from the model', () => {
    const start = PROFILE_OF_MODEL.multi_departments;
    expect(stepsChangedFromModel('multi_departments', start)).toBe(0);
    expect(
      stepsChangedFromModel('multi_departments', {
        ...start,
        signature: 'required',
        shuttleActsAsDepartment: true,
      }),
    ).toBe(2);
    expect(
      stepsChangedFromModel('multi_departments', DEFAULT_OPERATING_PROFILE),
    ).toBe(6);
  });

  it('leaves a company without a profile as it was', () => {
    expect(DEFAULT_OPERATING_PROFILE).toMatchObject({
      depositConfirmation: 'disabled',
      emailMoment: 'scan',
      reminders: 'optional',
    });
  });
});

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
    ['handoverProof', { handoverProof: 'required' }, 18],
    ['handoverScan', { handoverScan: 'required' }, 18],
    ['signature', { signature: 'required' }, 18],
    ['photo', { photo: 'disabled' }, 18],
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
    expect(impact.changes.map((change) => change.parcels)).toEqual([18, 18, 7]);
    expect(impact.parcels).toBe(18);
  });

  it('adds up parcels at different stages', () => {
    expect(
      impactOf({ batchReview: 'disabled', signature: 'required' }).parcels,
    ).toBe(21);
  });

  it('finds nothing when nothing changed', () => {
    expect(impactOf({})).toEqual({ changes: [], parcels: 0 });
  });
});
