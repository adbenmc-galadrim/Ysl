import {
  isApplied,
  isRejected,
  PUSH_BATCH_MAX,
  type PushInput,
  type PushOutput,
} from '@repo/contract/sync';
import type { CourrierDatabase, OutboxOp } from '#/features/db/schema';
import { describeError } from '#/features/sync/errors';

export type PushClient = (input: PushInput) => Promise<PushOutput>;

/**
 * Why the push stopped: the outbox is empty (`done`), the server asked for a
 * retry on one operation (`retry`), or the request itself failed (`failed`,
 * with the error).
 */
export type PushOutcome =
  | { stopped: 'done'; applied: number; rejected: number }
  | { stopped: 'retry'; applied: number; rejected: number }
  | { stopped: 'failed'; applied: number; rejected: number; error: unknown };

export type PushOptions = { batchSize?: number };

function toInput(ops: OutboxOp[]): PushInput {
  return {
    ops: ops.map(({ opId, entity, entityId, type, patch, clientTs }) => ({
      opId,
      entity,
      entityId,
      type,
      patch,
      clientTs,
    })),
  };
}

async function markTried(
  db: CourrierDatabase,
  ops: OutboxOp[],
  error: string,
): Promise<void> {
  await db.outbox
    .where('opId')
    .anyOf(ops.map((op) => op.opId))
    .modify((op: OutboxOp) => {
      op.attempts += 1;
      op.lastError = error;
    });
}

/**
 * Sends the queued operations in the order they were made, by batches, and
 * settles each one from the server's answer: applied ones leave the outbox,
 * rejected ones stay as `rejected` for a correction, a retry stops the run
 * where it stands. A request that fails outright (network, 401, 5xx) counts
 * an attempt on its batch and stops too.
 */
export async function pushOutbox(
  db: CourrierDatabase,
  client: PushClient,
  { batchSize = PUSH_BATCH_MAX }: PushOptions = {},
): Promise<PushOutcome> {
  let applied = 0;
  let rejected = 0;
  for (;;) {
    const ops = await db.outbox
      .where('state')
      .equals('queued')
      .limit(batchSize)
      .sortBy('seq');
    if (ops.length === 0) return { stopped: 'done', applied, rejected };

    let output: PushOutput;
    try {
      output = await client(toInput(ops));
    } catch (error) {
      await markTried(db, ops, describeError(error));
      return { stopped: 'failed', applied, rejected, error };
    }

    const stopped = await db.transaction('rw', db.outbox, async () => {
      for (const result of output.results) {
        if (isApplied(result.status)) {
          await db.outbox.where('opId').equals(result.opId).delete();
          applied += 1;
        } else if (isRejected(result.status)) {
          await db.outbox
            .where('opId')
            .equals(result.opId)
            .modify((op: OutboxOp) => {
              op.state = 'rejected';
              op.lastError = result.message ?? `HTTP ${result.status}`;
            });
          rejected += 1;
        } else {
          await db.outbox
            .where('opId')
            .equals(result.opId)
            .modify((op: OutboxOp) => {
              op.attempts += 1;
              op.lastError = result.message ?? `HTTP ${result.status}`;
            });
          return true;
        }
      }
      return false;
    });
    if (stopped) return { stopped: 'retry', applied, rejected };
  }
}
