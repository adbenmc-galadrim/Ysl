import { describe, expect, it } from 'vitest';
import {
  EMPTY_COMPOSITION,
  readComposition,
  saveComposition,
} from '#/compose/draft';
import type { KeyValueStore } from '#/journal';

function memoryStore(initial?: string): KeyValueStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set('spike-email:draft', initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('composition draft', () => {
  it('comes back intact after the app is reloaded', () => {
    const store = memoryStore();
    const composition = {
      ...EMPTY_COMPOSITION,
      to: 'nora@exemple.fr',
      body: 'Corps en cours',
      fields: { ...EMPTY_COMPOSITION.fields, code: '9999' },
    };
    saveComposition(store, composition);

    expect(readComposition(store)).toEqual(composition);
  });

  it('falls back to an empty draft when storage is damaged', () => {
    expect(readComposition(memoryStore('{oops'))).toEqual(EMPTY_COMPOSITION);
    expect(readComposition(memoryStore('null'))).toEqual(EMPTY_COMPOSITION);
  });
});
