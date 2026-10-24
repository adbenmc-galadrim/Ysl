import { describe, expect, it } from 'vitest';
import {
  compareVersion,
  INITIAL_UPDATE_STATE,
  isAppCache,
  offersUpdate,
  reduceUpdate,
  type UpdateState,
} from '#/features/update/version';

const LOCAL = '2026-10-24T09:00:00.000Z';
const REMOTE = '2026-10-24T11:00:00.000Z';

describe('compareVersion', () => {
  it('ignores a payload that is not a version file', () => {
    expect(compareVersion(LOCAL, '<html>Not found</html>')).toEqual({
      kind: 'unknown',
    });
    expect(compareVersion(LOCAL, null)).toEqual({ kind: 'unknown' });
    expect(compareVersion(LOCAL, { builtAt: REMOTE })).toEqual({
      kind: 'unknown',
    });
    expect(compareVersion(LOCAL, { version: '' })).toEqual({ kind: 'unknown' });
  });

  it('tells the same build from a newer one', () => {
    expect(compareVersion(LOCAL, { version: LOCAL })).toEqual({
      kind: 'same',
      remote: LOCAL,
    });
    expect(compareVersion(LOCAL, { version: REMOTE })).toEqual({
      kind: 'different',
      remote: REMOTE,
    });
  });
});

describe('isAppCache', () => {
  const scope = 'https://courrier.example/';

  it('matches the Workbox cache of the app scope', () => {
    expect(isAppCache(`workbox-precache-v2-${scope}`, scope)).toBe(true);
  });

  it('leaves the caches of the spikes alone', () => {
    expect(
      isAppCache(`workbox-precache-v2-${scope}spike-storage/`, scope),
    ).toBe(false);
    expect(isAppCache(`workbox-precache-v2-${scope}spike-ocr/`, scope)).toBe(
      false,
    );
  });

  it('leaves another origin alone', () => {
    expect(
      isAppCache('workbox-precache-v2-https://other.example/', scope),
    ).toBe(false);
  });
});

describe('reduceUpdate', () => {
  const different = reduceUpdate(INITIAL_UPDATE_STATE, {
    type: 'version',
    check: { kind: 'different', remote: REMOTE },
  });

  it('offers the update once version.json differs or a worker waits', () => {
    expect(different.available).toBe(true);
    expect(
      reduceUpdate(INITIAL_UPDATE_STATE, { type: 'sw-waiting' }).available,
    ).toBe(true);
  });

  it('does not offer anything for the same build', () => {
    expect(
      reduceUpdate(INITIAL_UPDATE_STATE, {
        type: 'version',
        check: { kind: 'same', remote: LOCAL },
      }).available,
    ).toBe(false);
  });

  it('keeps an offered update when a later check fails or goes offline', () => {
    const afterUnknown = reduceUpdate(different, {
      type: 'version',
      check: { kind: 'unknown' },
    });
    expect(afterUnknown).toBe(different);
    const afterSame = reduceUpdate(different, {
      type: 'version',
      check: { kind: 'same', remote: LOCAL },
    });
    expect(afterSame.available).toBe(true);
  });
});

describe('offersUpdate', () => {
  const available: UpdateState = { ...INITIAL_UPDATE_STATE, available: true };

  it('hides the toast while a batch holds it, until every hold is released', () => {
    const oneHold = reduceUpdate(available, { type: 'hold' });
    const twoHolds = reduceUpdate(oneHold, { type: 'hold' });
    const oneLeft = reduceUpdate(twoHolds, { type: 'release' });
    expect(offersUpdate(available)).toBe(true);
    expect(offersUpdate(oneHold)).toBe(false);
    expect(offersUpdate(oneLeft)).toBe(false);
    expect(offersUpdate(reduceUpdate(oneLeft, { type: 'release' }))).toBe(true);
  });

  it('never goes negative on a stray release', () => {
    expect(reduceUpdate(available, { type: 'release' }).held).toBe(0);
  });
});
