import { describe, expect, it } from 'vitest';
import { buildExport } from '../src/export.ts';
import { Journal, STORAGE_KEY, type KeyValueStore } from '../src/journal.ts';

const memoryStore = (
  initial?: string,
): KeyValueStore & { raw: () => string | null } => {
  let value: string | null = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    raw: () => value,
  };
};

const device = { standalone: true };

describe('journal', () => {
  it('attaches each trial to its parcel and mode', () => {
    const journal = new Journal(memoryStore(), device);
    journal.addTrial({ mode: 'viewfinder', carrier: 'ups', result: null });
    journal.addTrial({ mode: 'native', carrier: 'ups', result: null });
    journal.nextParcel();
    journal.addTrial({ mode: 'native', carrier: 'gls', result: null });
    expect(journal.trials.map((t) => [t.parcel, t.mode, t.carrier])).toEqual([
      [1, 'viewfinder', 'ups'],
      [1, 'native', 'ups'],
      [2, 'native', 'gls'],
    ]);
  });

  it('reloads trials, verdicts and the parcel counter from storage', () => {
    const store = memoryStore();
    const first = new Journal(store, device);
    first.nextParcel();
    const trial = first.addTrial({
      mode: 'native',
      carrier: 'dpd',
      result: null,
    });
    first.updateTrial(trial.id, { verdict: 'read', note: 'flou' });
    const reloaded = new Journal(store, device);
    expect(reloaded.parcel).toBe(2);
    expect(reloaded.trials).toHaveLength(1);
    expect(reloaded.trials[0]).toMatchObject({
      parcel: 2,
      mode: 'native',
      verdict: 'read',
      note: 'flou',
    });
  });

  it.each([
    ['not json', '{oops'],
    ['wrong type', '42'],
    ['null', 'null'],
    ['trials not an array', '{"parcel":3,"trials":"x"}'],
  ])('starts empty without crashing on damaged storage (%s)', (_name, raw) => {
    const journal = new Journal(memoryStore(raw), device);
    expect(journal.trials).toEqual([]);
    expect(journal.events).toEqual([]);
    expect(journal.parcel).toBeGreaterThanOrEqual(1);
    expect(() =>
      journal.addTrial({ mode: 'native', carrier: 'ups', result: null }),
    ).not.toThrow();
  });

  it('drops malformed trials and keeps the valid ones', () => {
    const good = {
      id: 'a',
      at: 1,
      parcel: 4,
      mode: 'viewfinder',
      carrier: 'ups',
      verdict: null,
      note: '',
    };
    const store = memoryStore(
      JSON.stringify({ parcel: 1, trials: [good, { id: 3 }, 'x'] }),
    );
    const journal = new Journal(store, device);
    expect(journal.trials.map((t) => t.id)).toEqual(['a']);
    expect(journal.parcel).toBe(4);
  });

  it('keeps working when storage refuses writes', () => {
    const journal = new Journal(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
      },
      device,
    );
    journal.addTrial({ mode: 'native', carrier: 'ups', result: null });
    expect(journal.trials).toHaveLength(1);
    expect(journal.saveFailed).toBe(true);
  });

  it('exports a serializable payload with rates by mode and carrier', () => {
    const store = memoryStore();
    const journal = new Journal(store, device);
    const a = journal.addTrial({
      mode: 'viewfinder',
      carrier: 'ups',
      result: null,
    });
    const b = journal.addTrial({
      mode: 'native',
      carrier: 'ups',
      result: null,
    });
    journal.updateTrial(a.id, { verdict: 'aucun-code' });
    journal.updateTrial(b.id, { verdict: 'read' });
    const payload = buildExport(journal);
    const copy = JSON.parse(JSON.stringify(payload)) as typeof payload;
    expect(copy.trials).toHaveLength(2);
    expect(copy.byMode.native).toEqual({ trials: 1, read: 1, rate: 1 });
    expect(copy.byMode.viewfinder).toEqual({ trials: 1, read: 0, rate: 0 });
    expect(copy.byCarrier.ups?.trials).toBe(2);
    expect(store.raw()).toContain('"parcel":1');
    expect(STORAGE_KEY).toBe('spike-barcode:journal');
  });
});
