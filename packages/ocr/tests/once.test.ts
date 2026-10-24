import { describe, expect, it } from 'vitest';
import { once } from '#worker/once';

describe('once', () => {
  it('loads a single time for every caller, warm-up and readings alike', async () => {
    let loads = 0;
    const ensure = once(() => {
      loads += 1;
      return Promise.resolve('engine');
    });
    await Promise.all([ensure(), ensure()]);
    await ensure();
    expect(loads).toBe(1);
  });

  it('tries again after a failed load', async () => {
    let loads = 0;
    const ensure = once(() => {
      loads += 1;
      return loads === 1
        ? Promise.reject(new Error('no wasm'))
        : Promise.resolve('engine');
    });
    await expect(ensure()).rejects.toThrow('no wasm');
    await expect(ensure()).resolves.toBe('engine');
    expect(loads).toBe(2);
  });
});
