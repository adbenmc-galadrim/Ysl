import { logger } from '@repo/shared/logger';

export type PurgeJobOptions = {
  /** Minutes between two runs; 0 turns the job off. */
  intervalMinutes: number;
  /** Runs one purge of every mailroom; `busy` when another instance holds the lock. */
  run: () => Promise<{ status: 'busy' | 'done' }>;
  /** The first run waits this long after start, so a deploy is not slowed by it. */
  firstDelayMs?: number;
};

/**
 * The retention purge (§9.2), started with the server. Each instance keeps
 * its own timer; the advisory lock lets one of them work and the others
 * pass their turn. A failed run is logged and the next one comes as usual.
 */
export function startPurgeJob({
  intervalMinutes,
  run,
  firstDelayMs = 60_000,
}: PurgeJobOptions): () => void {
  if (intervalMinutes <= 0) {
    logger.info('retention purge off');
    return () => undefined;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const outcome = await run();
      if (outcome.status === 'busy') {
        logger.info('retention purge skipped: another run holds the lock');
      }
    } catch (error) {
      logger.error({ err: error }, 'retention purge failed');
    } finally {
      running = false;
    }
  };
  let interval: ReturnType<typeof setInterval> | undefined;
  const first = setTimeout(() => {
    void tick();
    interval = setInterval(() => void tick(), intervalMinutes * 60_000);
    interval.unref();
  }, firstDelayMs);
  first.unref();
  return () => {
    clearTimeout(first);
    if (interval) clearInterval(interval);
  };
}
