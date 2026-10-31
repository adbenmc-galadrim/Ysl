import { UNFINISHED_STATUSES } from '@repo/contract/parcel-status';
import { describe, expect, it } from 'vitest';
import { homeCounts } from '#/features/shell/home-counts';

const rows = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe('homeCounts', () => {
  it('sets apart what is coming, what is here and what is to settle', () => {
    expect(
      homeCounts(
        rows(
          'en_route',
          'en_route',
          'depose',
          'recu',
          'notifie',
          'a_completer',
          'a_regulariser',
        ),
      ),
    ).toEqual({ coming: 2, present: 4, toSettle: 1 });
  });

  it('leaves out what has left the company', () => {
    expect(homeCounts(rows('remis', 'retourne'))).toEqual({
      coming: 0,
      present: 0,
      toSettle: 0,
    });
  });

  it('counts every unfinished status once, so the admin total is theirs', () => {
    const { coming, present, toSettle } = homeCounts(
      rows(...UNFINISHED_STATUSES),
    );
    expect(coming + present + toSettle).toBe(UNFINISHED_STATUSES.length);
  });

  it('ignores a status this version does not know', () => {
    expect(homeCounts(rows('demain'))).toEqual({
      coming: 0,
      present: 0,
      toSettle: 0,
    });
  });
});
