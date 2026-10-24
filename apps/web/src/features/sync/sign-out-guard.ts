import type { CourrierDatabase } from '#/features/db/schema';
import { countOutbox } from '#/features/sync/outbox-counts';

export type SignOutCheck =
  { ok: true } | { ok: false; pending: number; rejected: number };

/** Thrown by the sign-out mutation when changes are still on the phone. */
export class SignOutBlockedError extends Error {
  constructor(
    readonly pending: number,
    readonly rejected: number,
  ) {
    super(`${pending} change(s) not sent, ${rejected} refused`);
    this.name = 'SignOutBlockedError';
  }
}

/**
 * Signing out wipes the device, so the outbox goes first (§8.4). One last
 * synchronisation is run, or joined if one is going, so no page lands after
 * the wipe; whatever is still queued afterwards, offline or refused by the
 * server for the moment, blocks the sign-out and is counted. Changes the
 * server refused for good block too: wiping them would lose the only copy
 * before anyone corrected them.
 */
export async function prepareSignOut(
  db: CourrierDatabase,
  syncNow: (options: { force: true }) => Promise<unknown>,
): Promise<SignOutCheck> {
  await syncNow({ force: true });
  const { pending, rejected } = await countOutbox(db);
  return pending + rejected === 0
    ? { ok: true }
    : { ok: false, pending, rejected };
}
