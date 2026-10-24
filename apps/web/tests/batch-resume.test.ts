import { describe, expect, it } from 'vitest';
import { formatBatchStart, offersResume } from '#/features/batch/resume';
import { NOW } from './helpers/local-rows';

const earlier = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60 * 1000);

const batch = { id: 'b', startedAt: earlier(90) };
const last = { createdAt: earlier(60) };

describe('offersResume', () => {
  it('offers a batch started before this launch', () => {
    expect(offersResume(batch, last, NOW, undefined)).toBe(true);
  });

  it('leaves a batch opened in this session to the Scan screen', () => {
    expect(
      offersResume(
        { ...batch, startedAt: NOW },
        { createdAt: NOW },
        NOW,
        undefined,
      ),
    ).toBe(false);
  });

  it('leaves a batch the agent kept filling after a launch on Scan', () => {
    expect(offersResume(batch, { createdAt: NOW }, NOW, undefined)).toBe(false);
  });

  it('offers neither an empty batch nor one already answered', () => {
    expect(offersResume(batch, undefined, NOW, undefined)).toBe(false);
    expect(offersResume(batch, last, NOW, 'b')).toBe(false);
    expect(offersResume(undefined, undefined, NOW, undefined)).toBe(false);
  });
});

describe('formatBatchStart', () => {
  it('says the time today, the day before that', () => {
    expect(formatBatchStart(earlier(89), NOW)).toBe('de 10 h 31');
    expect(formatBatchStart(earlier(24 * 60), NOW)).toBe('d’hier à 12 h 00');
    expect(formatBatchStart(earlier(3 * 24 * 60), NOW)).toBe(
      'du 21 octobre à 12 h 00',
    );
  });
});
