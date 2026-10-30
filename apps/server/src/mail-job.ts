import type { DrainCounts } from '@repo/api';
import { logger } from '@repo/shared/logger';

export type MailJobOptions = {
  /** Seconds between two runs; 0 turns the job off. */
  intervalSeconds: number;
  /** `signal` aborts when the server stops: no new message after it. */
  run: (signal: AbortSignal) => Promise<DrainCounts>;
};

/**
 * Drains the e-mail queue, started with the server. Each instance keeps its
 * own timer; `SKIP LOCKED` shares the rows. A failed run is logged and the
 * next one comes as usual.
 */
export function startMailJob({
  intervalSeconds,
  run,
}: MailJobOptions): () => Promise<void> {
  if (intervalSeconds <= 0) {
    logger.info('mail job off');
    return () => Promise.resolve();
  }
  const stopping = new AbortController();
  let current: Promise<void> | null = null;
  const drain = async () => {
    try {
      const counts = await run(stopping.signal);
      if (counts.blocked > 0) {
        logger.error('mail job blocked: the provider refuses the account');
      }
      if (counts.sent + counts.retry + counts.failed > 0) {
        logger.info(counts, 'mail queue drained');
      }
    } catch (error) {
      logger.error({ err: error }, 'mail job failed');
    } finally {
      current = null;
    }
  };
  const interval = setInterval(() => {
    current ??= drain();
  }, intervalSeconds * 1_000);
  interval.unref();
  return async () => {
    clearInterval(interval);
    stopping.abort();
    await current;
  };
}
