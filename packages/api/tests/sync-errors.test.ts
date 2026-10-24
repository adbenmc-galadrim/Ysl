import { describe, expect, it } from 'vitest';
import {
  constraintOf,
  messageOf,
  reasonOf,
  statusOf,
} from '#features/sync/errors';

/** What drizzle hands back: its own error wrapping the driver's. */
function wrapped(fields: { message: string } & Record<string, unknown>) {
  const cause = Object.assign(new Error(fields.message), fields);
  return Object.assign(new Error('Failed query: update "parcel" …'), {
    cause,
  });
}

describe('guards in sync errors', () => {
  it('turn a refused transition into a 409 with its own line', () => {
    const error = wrapped({
      code: '23514',
      constraint: 'parcel_status_transition',
      message: 'parcel 0199 cannot go from remis to recu',
    });

    expect(statusOf(error)).toBe(409);
    expect(constraintOf(error)).toBe('parcel_status_transition');
    expect(messageOf(409, 'parcel_status_transition')).toMatch(/statut/);
    expect(reasonOf(error)).toBe(
      'parcel_status_transition: parcel 0199 cannot go from remis to recu',
    );
  });

  it('keep a plain check violation at 400', () => {
    const error = wrapped({
      code: '23514',
      constraint: 'parcel_weight_check',
      message: 'new row violates check constraint',
    });

    expect(statusOf(error)).toBe(400);
    expect(messageOf(400)).toMatch(/invalides/);
  });

  it('keep only the SQLSTATE or the name when no constraint is known', () => {
    expect(
      reasonOf(
        wrapped({
          code: '22P02',
          message: 'invalid input syntax for type uuid: "secret"',
        }),
      ),
    ).toBe('22P02');
    expect(reasonOf(new RangeError('Invalid time value'))).toBe('RangeError');
  });
});
