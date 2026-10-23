import { describe, expect, it } from 'vitest';
import { Journal, type KeyValueStore } from '#/journal';

function memoryStore(initial?: string): KeyValueStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('spike-email:journal', initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const trial = {
  target: 'mailto' as const,
  source: 'accents',
  recipients: 1,
  subjectLength: 10,
  bodyLength: 100,
  urlLength: 300,
};

describe('Journal', () => {
  it('keeps a verdict across a reload of the app', () => {
    const store = memoryStore();
    const journal = new Journal(store, {}, () => 1);
    const id = journal.add(trial);
    journal.update(id, { verdict: 'partial', note: 'corps tronqué' });

    const reloaded = new Journal(store, {}, () => 2);

    expect(reloaded.trials).toEqual([
      {
        id,
        at: 1,
        ...trial,
        verdict: 'partial',
        note: 'corps tronqué',
      },
    ]);
  });

  it('starts empty when the stored journal is damaged', () => {
    expect(new Journal(memoryStore('{oops'), {}).trials).toEqual([]);
    expect(new Journal(memoryStore('null'), {}).trials).toEqual([]);
  });

  it('exports the device and the trials as plain JSON', () => {
    const journal = new Journal(memoryStore(), { standalone: true }, () => 1);
    journal.add(trial);

    const exported = JSON.parse(JSON.stringify(journal)) as unknown;

    expect(exported).toEqual({
      device: { standalone: true },
      loads: [],
      trials: [{ id: '1-1', at: 1, ...trial }],
    });
  });

  it('tells that iOS reloaded the page after a trial', () => {
    const store = memoryStore();
    let now = 1;
    const journal = new Journal(store, {}, () => now);
    journal.markLoad();
    now = 2;
    journal.add(trial);
    now = 3;

    const reloaded = new Journal(store, {}, () => now);
    reloaded.markLoad();

    expect(reloaded.loads).toEqual([1, 3]);
    expect(reloaded.reloadedAfter(reloaded.trials[0]!)).toBe(true);
    expect(journal.reloadedAfter(journal.trials[0]!)).toBe(false);
  });

  it('flags a journal the browser refused to save', () => {
    const journal = new Journal(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
      {},
    );

    journal.add(trial);

    expect(journal.notSaved).toBe(true);
    expect(journal.trials).toHaveLength(1);
  });
});
