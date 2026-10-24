import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { formatBytes } from '#/features/db/storage';
import { storageValue } from '#/features/settings/storage-value';

const t = createTranslator('fr');

describe('formatBytes', () => {
  it('reads like the settings screen', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(58_000_000)).toBe('58 Mo');
    expect(formatBytes(1_370_000_000)).toBe('1,4 Go');
    expect(formatBytes(9_960_000)).toBe('10 Mo');
  });
});

describe('storageValue', () => {
  it('shows the space taken once the storage is persistent', () => {
    expect(
      storageValue({ persisted: true, usage: 58_000_000, quota: 1e9 }, t),
    ).toBe('58 Mo');
  });

  it('warns when the browser may evict the data', () => {
    expect(
      storageValue({ persisted: false, usage: 58_000_000, quota: 1e9 }, t),
    ).toBe('Non persistant');
  });

  it('stays blank until the estimate is known', () => {
    expect(storageValue(undefined, t)).toBeUndefined();
    expect(
      storageValue(
        { persisted: undefined, usage: undefined, quota: undefined },
        t,
      ),
    ).toBeUndefined();
  });
});
