import { logger } from '@repo/shared/logger';

export type MailJobOptions = {
  /** Seconds between two runs; 0 turns the job off. */
  intervalSeconds: number;
  run: () => Promise<{ sent: number; retry: number; failed: number }>;
};

/**
 * Drains the e-mail queue, started with the server. Each instance keeps its
 * own timer; `SKIP LOCKED` shares the rows. A failed run is logged and the
 * next one comes as usual.
 */
export function startMailJob({
  intervalSeconds,
  run,
}: MailJobOptions): () => void {
  if (intervalSeconds <= 0) {
    logger.info('mail job off');
    return () => undefined;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const counts = await run();
      if (counts.sent + counts.retry + counts.failed > 0) {
        logger.info(counts, 'mail queue drained');
      }
    } catch (error) {
      logger.error({ err: error }, 'mail job failed');
    } finally {
      running = false;
    }
  };
  const interval = setInterval(() => void tick(), intervalSeconds * 1_000);
  interval.unref();
  return () => {
    clearInterval(interval);
  };
}
