import { describe, expect, it } from 'vitest';
import { checkVersion, type Fetcher } from '#/update/version';

const URL = '/spike-storage/version.json';

function answering(body: unknown, ok = true): Fetcher {
  return () =>
    Promise.resolve({
      ok,
      json: () =>
        body instanceof Error ? Promise.reject(body) : Promise.resolve(body),
    });
}

describe('checkVersion', () => {
  it('finds nothing to update when the versions are equal', async () => {
    const result = await checkVersion(
      '2026-01-01',
      URL,
      answering({ version: '2026-01-01', builtAt: '2026-01-01' }),
    );

    expect(result.kind).toBe('same');
  });

  it('reports a different remote version', async () => {
    const result = await checkVersion(
      '2026-01-01',
      URL,
      answering({ version: '2026-02-01' }),
    );

    expect(result).toEqual({ kind: 'different', remote: '2026-02-01' });
  });

  it('ignores an invalid answer', async () => {
    expect(
      (await checkVersion('1', URL, answering(new SyntaxError()))).kind,
    ).toBe('unknown');
    expect((await checkVersion('1', URL, answering({ other: 2 }))).kind).toBe(
      'unknown',
    );
    expect((await checkVersion('1', URL, answering(null))).kind).toBe(
      'unknown',
    );
    expect((await checkVersion('1', URL, answering({}, false))).kind).toBe(
      'unknown',
    );
  });

  it('ignores a failed fetch without throwing', async () => {
    const offline: Fetcher = () => Promise.reject(new TypeError('offline'));

    await expect(checkVersion('1', URL, offline)).resolves.toEqual({
      kind: 'unknown',
    });
  });

  it('asks for a fresh answer', async () => {
    let init: unknown;
    await checkVersion('1', URL, (_url, options) => {
      init = options;
      return answering({ version: '1' })(_url, options);
    });

    expect(init).toEqual({ cache: 'no-store' });
  });
});
