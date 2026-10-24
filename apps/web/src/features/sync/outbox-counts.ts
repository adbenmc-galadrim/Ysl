import type { CourrierDatabase } from '#/features/db/schema';

export type OutboxCounts = {
  /** Changes made on this device that the server has not taken yet. */
  pending: number;
  /** Changes the server refused for good, waiting for a correction. */
  rejected: number;
  /** When the change that has waited the longest was made; `null` once all sent. */
  oldestAt: Date | null;
};

export const EMPTY_OUTBOX: OutboxCounts = {
  pending: 0,
  rejected: 0,
  oldestAt: null,
};

export async function countOutbox(db: CourrierDatabase): Promise<OutboxCounts> {
  const [pending, rejected, oldest] = await Promise.all([
    db.outbox.where('state').equals('queued').count(),
    db.outbox.where('state').equals('rejected').count(),
    db.outbox.orderBy('clientTs').first(),
  ]);
  return { pending, rejected, oldestAt: oldest?.clientTs ?? null };
}
