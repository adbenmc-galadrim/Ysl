import { describe, expect, it } from 'vitest';
import { captureStats, Journal, type KeyValueStore } from '#/metrics/journal';

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('Journal sessions', () => {
  it('reports a previous session that was never closed', () => {
    const store = memoryStore();
    const first = new Journal(store, {}, () => 1);
    first.log('stream-started');

    const second = new Journal(store, {}, () => 2);

    expect(second.interrupted?.id).toBe('1');
    expect(second.interrupted?.entries).toHaveLength(1);
  });

  it('does not report a session closed on purpose', () => {
    const store = memoryStore();
    new Journal(store, {}, () => 1).close();

    expect(new Journal(store, {}, () => 2).interrupted).toBeUndefined();
  });
});

const shot = {
  mode: 'grabFrame' as const,
  width: 4032,
  height: 3024,
  sourceWidth: 4032,
  sourceHeight: 3024,
  bytes: 1,
  durationMs: 100,
};

describe('captureStats', () => {
  it('measures intervals inside a burst only', () => {
    const journal = new Journal(memoryStore(), {});
    journal.capture({ ...shot, at: 0 });
    journal.capture({ ...shot, at: 5_000, burst: 1 });
    journal.capture({ ...shot, at: 5_400, burst: 1 });
    journal.capture({ ...shot, at: 6_300, burst: 1 });
    journal.capture({ ...shot, at: 9_000, burst: 2 });

    const stats = captureStats(journal.session.entries);

    expect(stats.count).toBe(5);
    expect(stats.maxIntervalMs).toBe(900);
    expect(stats.lastIntervalMs).toBe(900);
    expect(stats.p95IntervalMs).toBe(900);
  });

  it('takes the 95th percentile by nearest rank', () => {
    const journal = new Journal(memoryStore(), {});
    for (let index = 0; index < 20; index++) {
      journal.capture({ ...shot, at: index, durationMs: index + 1 });
    }

    const stats = captureStats(journal.session.entries);

    expect(stats.p95DurationMs).toBe(19);
    expect(stats.maxDurationMs).toBe(20);
  });

  it('counts stream restarts and failures', () => {
    const journal = new Journal(memoryStore(), {});
    journal.log('stream-started');
    journal.log('stream-restarted');
    journal.log('grabframe-failed');
    journal.log('capture-failed');

    const stats = captureStats(journal.session.entries);

    expect(stats.restarts).toBe(1);
    expect(stats.failures).toBe(2);
  });
});
