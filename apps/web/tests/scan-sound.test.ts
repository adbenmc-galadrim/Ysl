import { describe, expect, it } from 'vitest';
import {
  readScanSound,
  SCAN_SOUND_KEY,
  writeScanSound,
} from '#/features/settings/sound';

function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(SCAN_SOUND_KEY, initial);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe('readScanSound', () => {
  it('is on until the agent turns it off', () => {
    expect(readScanSound(memoryStorage())).toBe(true);
    expect(readScanSound(memoryStorage('false'))).toBe(false);
    expect(readScanSound(memoryStorage('true'))).toBe(true);
  });

  it('is on when the saved value is broken', () => {
    expect(readScanSound(memoryStorage('{'))).toBe(true);
    expect(readScanSound(memoryStorage('off'))).toBe(true);
  });

  it('reads back what was written', () => {
    const storage = memoryStorage();
    writeScanSound(false, storage);
    expect(readScanSound(storage)).toBe(false);
    writeScanSound(true, storage);
    expect(readScanSound(storage)).toBe(true);
  });

  it('survives a storage that refuses', () => {
    const refusing = {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: () => {
        throw new Error('private mode');
      },
    };
    expect(() => writeScanSound(false, refusing)).not.toThrow();
    expect(readScanSound(refusing)).toBe(true);
  });
});
