import { link, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export const LOCK_POLL_MS = 30_000;

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export type LockOptions = {
  pollMs?: number;
  log?: (line: string) => void;
  alive?: (pid: number) => boolean;
  sleep?: (ms: number) => Promise<unknown>;
};

/**
 * One agent at a time on the PC, whatever started it: a report that arrives
 * while an agent works waits here. A lock left by a dead process is taken over.
 * Linked from a file already holding the pid: the lock is never seen empty.
 */
export async function acquireLock(
  file: string,
  {
    pollMs = LOCK_POLL_MS,
    log = console.log,
    alive = isAlive,
    sleep = (ms) => delay(ms),
  }: LockOptions = {},
): Promise<() => Promise<void>> {
  let told = false;
  const mine = `${file}.${process.pid}`;
  await writeFile(mine, `${process.pid}\n`);
  for (;;) {
    try {
      await link(mine, file);
      await rm(mine, { force: true });
      return () => rm(file, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        await rm(mine, { force: true });
        throw error;
      }
    }
    const holder = Number(
      (await readFile(file, 'utf8').catch(() => '')).trim(),
    );
    if (!Number.isInteger(holder) || holder <= 0 || !alive(holder)) {
      await rm(file, { force: true });
      continue;
    }
    if (!told) {
      log(`Un agent tourne déjà (pid ${holder}) : ce rapport attend son tour.`);
      told = true;
    }
    await sleep(pollMs);
  }
}
