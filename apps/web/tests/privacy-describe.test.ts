import { describe, expect, it } from 'vitest';
import {
  describePurge,
  formatDuration,
  retentionGroup,
} from '#/features/retention/describe';

const now = new Date(2026, 9, 27, 9, 0);

describe('privacy screen texts', () => {
  it('shows the §9.2 durations', () => {
    expect(retentionGroup.items.map((item) => item.value)).toEqual([
      '7 jours',
      '30 jours',
      '12 mois',
      '12 mois',
      '12 mois',
    ]);
    expect(formatDuration({ amount: 1, unit: 'day' })).toBe('1 jour');
  });

  it('sums up the last purge, or says it found nothing', () => {
    const at = new Date(2026, 9, 27, 3, 0);
    expect(
      describePurge(
        {
          trigger: 'auto',
          startedAt: at,
          finishedAt: at,
          counts: {
            parcel: { marked: 38, deleted: 2 },
            contact: { marked: 1, deleted: 0 },
          },
        },
        now,
      ),
    ).toBe(
      'Aujourd’hui à 3 h 00 : 38 colis retirés, 1 contact retiré, 41 lignes traitées',
    );
    expect(
      describePurge(
        { trigger: 'manual', startedAt: at, finishedAt: at, counts: {} },
        now,
      ),
    ).toBe('Aujourd’hui à 3 h 00 : rien à purger');
  });
});
