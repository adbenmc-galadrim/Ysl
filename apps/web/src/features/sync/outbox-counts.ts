import type { CourrierDatabase } from '#/features/db/schema';

export type OutboxCounts = {
  /** Changes made on this device that the server has not taken yet. */
  pending: number;
  /** Changes the server refused for good, waiting for a correction. */
  rejected: number;
};

export const EMPTY_OUTBOX: OutboxCounts = { pending: 0, rejected: 0 };

export async function countOutbox(db: CourrierDatabase): Promise<OutboxCounts> {
  const [pending, rejected] = await Promise.all([
    db.outbox.where('state').equals('queued').count(),
    db.outbox.where('state').equals('rejected').count(),
  ]);
  return { pending, rejected };
}
