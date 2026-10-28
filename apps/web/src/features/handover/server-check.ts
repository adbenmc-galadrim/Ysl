import type { OnlineCheck } from '#/features/handover/pickup-lookup';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';

/** `pickup.verify` and the engine of this iPhone, for the desk. */
export const serverCheck: OnlineCheck = {
  online: () => navigator.onLine,
  verify: (input) => trpcClient.pickup.verify.query(input),
  sync: () => syncNow({ force: true }),
};
