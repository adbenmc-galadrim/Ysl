import { describe, expect, it } from 'vitest';
import {
  PARTIAL_KEY,
  RunJournal,
  RUN_KEY,
  type KeyValueStore,
} from '#/metrics/run-journal';
import type { SeriesResult } from '#/metrics/types';

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

const run = {
  configId: 'paddle-v6-small-wasm',
  label: 'PP-OCRv6 small · WASM',
  source: 'pack' as const,
  total: 50,
};

function series(overrides: Partial<SeriesResult> = {}): SeriesResult {
  return {
    configId: run.configId,
    label: run.label,
    backend: 'wasm',
    source: 'pack',
    startedAt: 1,
    outcome: 'complete',
    photos: [],
    ...overrides,
  };
}

describe('RunJournal', () => {
  it('reports a series left open with its configuration and photo', () => {
    const store = memoryStore();
    const first = new RunJournal(store, () => 1);
    first.begin(run);
    first.beforePhoto(17, 'synthetic-dhl-express-05');

    const second = new RunJournal(store, () => 2);

    expect(second.interrupted?.photo).toBe(17);
    expect(second.interrupted?.configId).toBe('paddle-v6-small-wasm');
    const crash = second.entries.find(
      (event) => event.name === 'crash-detected',
    );
    expect(crash?.detail).toContain('photo 17');
    expect(crash?.detail).toContain('PP-OCRv6 small · WASM');
  });

  it('keeps the photos measured before the crash as a crashed result', () => {
    const store = memoryStore();
    const first = new RunJournal(store, () => 1);
    first.begin(run);
    first.beforePhoto(3, 'p3');
    first.checkpoint(
      series({
        photos: [
          { id: 'p1', name: 'p1', ok: true, prepMs: 1, ocrMs: 2, totalMs: 3 },
          { id: 'p2', name: 'p2', ok: true, prepMs: 1, ocrMs: 2, totalMs: 3 },
        ],
      }),
    );

    const second = new RunJournal(store, () => 2);

    expect(second.history).toHaveLength(1);
    expect(second.history[0]?.outcome).toBe('crashed');
    expect(second.history[0]?.photos).toHaveLength(2);
    expect(second.history[0]?.detail).toContain('photo 3');
  });

  it('reports a crash only once', () => {
    const store = memoryStore();
    const first = new RunJournal(store, () => 1);
    first.begin(run);
    first.beforePhoto(2, 'p2');
    new RunJournal(store, () => 2);

    expect(store.getItem(RUN_KEY)).toBeNull();
    expect(new RunJournal(store, () => 3).interrupted).toBeUndefined();
  });

  it('does not report a series closed on purpose', () => {
    const store = memoryStore();
    const first = new RunJournal(store, () => 1);
    first.begin(run);
    first.beforePhoto(50, 'p50');
    first.close(series());

    const second = new RunJournal(store, () => 2);

    expect(second.interrupted).toBeUndefined();
    expect(second.history.map((entry) => entry.outcome)).toEqual(['complete']);
  });

  it('ignores the partial result left by an earlier series', () => {
    const store = memoryStore();
    const first = new RunJournal(store, () => 1);
    first.begin(run);
    first.checkpoint(
      series({
        photos: [
          { id: 'p1', name: 'p1', ok: true, prepMs: 1, ocrMs: 2, totalMs: 3 },
        ],
      }),
    );
    first.begin({
      configId: 'tesseract-wasm',
      label: 'Tesseract · WASM',
      source: 'pack',
      total: 50,
    });

    const second = new RunJournal(store, () => 2);

    expect(second.history[0]?.configId).toBe('tesseract-wasm');
    expect(second.history[0]?.label).toBe('Tesseract · WASM');
    expect(second.history[0]?.photos).toEqual([]);
  });

  it('clears the partial result when a series closes', () => {
    const store = memoryStore();
    const journal = new RunJournal(store, () => 1);
    journal.begin(run);
    journal.checkpoint(series());
    journal.close(series());

    expect(store.getItem(PARTIAL_KEY)).toBeNull();
  });
});
