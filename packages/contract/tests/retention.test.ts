import { describe, expect, it } from 'vitest';
import {
  parseCompanySettings,
  resolveRetention,
  retentionProblem,
} from '../src/company-settings';
import { cutoff, purgeTotals, RETENTION } from '../src/retention';

describe('retention', () => {
  it('counts days back to the millisecond', () => {
    expect(
      cutoff(new Date('2026-10-27T03:00:00Z'), RETENTION.photo).toISOString(),
    ).toBe('2026-10-20T03:00:00.000Z');
  });

  it('counts months on the calendar, the 31st falling back to the last day', () => {
    expect(
      cutoff(new Date('2026-10-27T03:00:00Z'), RETENTION.parcel).toISOString(),
    ).toBe('2025-10-27T03:00:00.000Z');
    expect(
      cutoff(new Date('2028-03-31T12:00:00Z'), {
        amount: 1,
        unit: 'month',
      }).toISOString(),
    ).toBe('2028-02-29T12:00:00.000Z');
    expect(
      cutoff(new Date('2026-01-15T00:00:00Z'), {
        amount: 13,
        unit: 'month',
      }).toISOString(),
    ).toBe('2024-12-15T00:00:00.000Z');
  });

  it('sums a report: parcels and people set aside, rows touched', () => {
    expect(
      purgeTotals({
        parcel: { marked: 3, deleted: 2 },
        event: { marked: 0, deleted: 9 },
        contact: { marked: 1, deleted: 0 },
        directory_person: { marked: 1, deleted: 0 },
      }),
    ).toEqual({ parcels: 3, contacts: 2, rows: 16 });
  });
});

describe('the durations of a company', () => {
  it('keeps the defaults of §9.2 without a setting, or with one out of bounds', () => {
    expect(resolveRetention(undefined)).toEqual(RETENTION);
    expect(resolveRetention({ parcel: 0, emailOutbox: 1 })).toEqual(RETENTION);
  });

  it('takes its own, in the fixed unit of each', () => {
    expect(resolveRetention({ photo: 3 }).photo).toEqual({
      amount: 3,
      unit: 'day',
    });
    expect(resolveRetention({ parcel: 24 }).parcel).toEqual({
      amount: 24,
      unit: 'month',
    });
  });

  it('never lets a signature outlive its parcel', () => {
    expect(resolveRetention({ parcel: 3 }).signature.amount).toBe(3);
    expect(retentionProblem({ parcel: 3 })).toBeNull();
    expect(retentionProblem({ parcel: 3, signature: 6 })).toBe(
      'signatureOutlivesParcel',
    );
  });

  it('reads an unreadable row as no setting at all', () => {
    expect(parseCompanySettings('nope')).toEqual({});
    expect(parseCompanySettings(undefined)).toEqual({});
    expect(parseCompanySettings({ logoId: 'x' }).logoId).toBeNull();
  });
});
