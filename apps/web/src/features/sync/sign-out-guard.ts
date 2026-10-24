import type { CourrierDatabase } from '#/features/db/schema';

export type SignOutCheck = { ok: true } | { ok: false; pending: number };

/** Thrown by the sign-out mutation when changes are still on the phone. */
export class SignOutBlockedError extends Error {
  constructor(readonly pending: number) {
    super(`${pending} change(s) not sent yet`);
    this.name = 'SignOutBlockedError';
  }
}

/**
 * Signing out wipes the device, so the outbox goes first (§8.4). One last
 * synchronisation is tried; whatever is still queued afterwards, offline or
 * refused by the server for the moment, blocks the sign-out and is counted.
 * Rejected changes do not block: sending them again would change nothing.
 */
export async function prepareSignOut(
  db: CourrierDatabase,
  syncNow: () => Promise<unknown>,
): Promise<SignOutCheck> {
  const queued = await db.outbox.where('state').equals('queued').count();
  if (queued > 0) await syncNow();
  const pending = await db.outbox.where('state').equals('queued').count();
  return pending === 0 ? { ok: true } : { ok: false, pending };
}
