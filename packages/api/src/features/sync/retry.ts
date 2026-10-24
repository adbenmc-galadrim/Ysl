import { isRetryable } from '#features/sync/errors';

export const RETRY_ATTEMPTS = 3;

/**
 * Runs a transaction again when Postgres gave up on it for a reason that
 * passes on its own: a serialization failure, a deadlock, a lock timeout.
 * Anything else, or the last attempt, is thrown as is.
 */
export async function withRetry<T>(
  run: () => Promise<T>,
  attempts = RETRY_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
    }
  }
}
