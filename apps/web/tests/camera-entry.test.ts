import { describe, expect, it } from 'vitest';
import {
  cameraEntry,
  markExplained,
  wasExplained,
} from '#/features/camera/entry';

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe('cameraEntry', () => {
  it('explains once, before the first prompt', () => {
    expect(cameraEntry(false, 'prompt')).toBe('explain');
    expect(cameraEntry(false, 'unknown')).toBe('explain');
    expect(cameraEntry(true, 'prompt')).toBe('scan');
  });

  it('skips the explanation when the camera is already granted', () => {
    expect(cameraEntry(false, 'granted')).toBe('scan');
  });

  it('leaves a known refusal to the viewfinder, explained or not', () => {
    expect(cameraEntry(true, 'denied')).toBe('scan');
    expect(cameraEntry(false, 'denied')).toBe('scan');
  });
});

describe('wasExplained', () => {
  it('remembers the explanation on this device', () => {
    const storage = memoryStorage();
    expect(wasExplained(storage)).toBe(false);
    markExplained(storage);
    expect(wasExplained(storage)).toBe(true);
  });

  it('reads a broken storage as not explained', () => {
    const storage: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => {
        throw new DOMException('private', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('private', 'SecurityError');
      },
    };
    expect(() => markExplained(storage)).not.toThrow();
    expect(wasExplained(storage)).toBe(false);
  });
});
