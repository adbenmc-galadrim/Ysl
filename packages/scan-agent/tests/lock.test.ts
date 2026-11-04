import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireLock } from '#lock';

const lockFile = async () =>
  join(await mkdtemp(join(tmpdir(), 'scan-agent-lock-')), 'verrou');

describe('acquireLock', () => {
  it('makes a second taker wait until the first releases', async () => {
    const file = await lockFile();
    const release = await acquireLock(file);
    const lines: string[] = [];
    let waited = 0;
    const second = acquireLock(file, {
      log: (line) => lines.push(line),
      sleep: async () => {
        waited += 1;
        if (waited === 2) await release();
      },
    });
    const releaseSecond = await second;
    expect(waited).toBe(2);
    expect(lines).toEqual([
      `Un agent tourne déjà (pid ${process.pid}) : ce rapport attend son tour.`,
    ]);
    await releaseSecond();
    expect(existsSync(file)).toBe(false);
  });

  it('takes over a lock left by a dead process', async () => {
    const file = await lockFile();
    await writeFile(file, '999999\n');
    const release = await acquireLock(file, {
      alive: () => false,
      sleep: () => Promise.reject(new Error('ne doit pas attendre')),
    });
    await release();
  });
});
