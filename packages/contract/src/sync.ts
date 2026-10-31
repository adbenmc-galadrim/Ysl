import { z } from 'zod';

/** The server tables a device mirrors, in the order a pull walks them. */
export const SYNCED_ENTITIES = [
  'directory_person',
  'contact',
  'sender',
  'sender_account',
  'batch',
  'parcel',
  'email_template',
  'notification',
  'pickup_code',
  'handover',
  'event',
  'setting',
  'sender_alias',
  'recipient_alias',
  'department',
] as const;

export const syncedEntity = z.enum(SYNCED_ENTITIES);

export type SyncedEntity = z.infer<typeof syncedEntity>;

export const SYNC_OP_TYPES = ['upsert', 'delete'] as const;

export const syncOpType = z.enum(SYNC_OP_TYPES);

export type SyncOpType = z.infer<typeof syncOpType>;

export const PUSH_BATCH_MAX = 100;

/** One change made on a device, as `sync.push` receives it. */
export const syncOp = z.object({
  opId: z.uuid(),
  entity: syncedEntity,
  entityId: z.uuid(),
  type: syncOpType,
  patch: z.record(z.string(), z.unknown()),
  clientTs: z.date(),
});

export type SyncOp = z.infer<typeof syncOp>;

export const pushInput = z.object({
  ops: z.array(syncOp).min(1).max(PUSH_BATCH_MAX),
});

export type PushInput = z.infer<typeof pushInput>;

/**
 * What became of one operation. 200: applied, now or by an earlier push.
 * 400, 403, 404, 409: abandoned, the device marks the row to be corrected.
 * 503: the server could not take it this time; send it again later.
 */
export const SYNC_STATUS = {
  applied: 200,
  badRequest: 400,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  retry: 503,
} as const;

export const syncStatus = z.union([
  z.literal(SYNC_STATUS.applied),
  z.literal(SYNC_STATUS.badRequest),
  z.literal(SYNC_STATUS.forbidden),
  z.literal(SYNC_STATUS.notFound),
  z.literal(SYNC_STATUS.conflict),
  z.literal(SYNC_STATUS.retry),
]);

export type SyncStatus = z.infer<typeof syncStatus>;

export function isApplied(status: SyncStatus): boolean {
  return status === SYNC_STATUS.applied;
}

/** Abandoned for good: sending it again would get the same answer. */
export function isRejected(status: SyncStatus): boolean {
  return status >= 400 && status < 500;
}

export const pushResult = z.object({
  opId: z.uuid(),
  status: syncStatus,
  message: z.string().optional(),
});

export type PushResult = z.infer<typeof pushResult>;

/**
 * One result per operation, in the order sent. A 503 ends the list early:
 * the operations after it were not looked at.
 */
export const pushOutput = z.object({ results: z.array(pushResult) });

export type PushOutput = z.infer<typeof pushOutput>;

export const PULL_PAGE_DEFAULT = 200;

export const PULL_PAGE_MAX = 1000;

/** Where a device stands: the generation of the server and the first transaction id it has not seen. */
export const syncCursor = z.object({
  generation: z.uuid(),
  xid: z.number().int().nonnegative(),
});

export type SyncCursor = z.infer<typeof syncCursor>;

/**
 * The page after this one. Both bounds are fixed by the first page, so the
 * whole pull reads one range; `entity` indexes `SYNCED_ENTITIES`.
 */
export const pullPage = z.object({
  from: z.number().int().nonnegative(),
  bound: z.number().int().nonnegative(),
  entity: z
    .number()
    .int()
    .min(0)
    .max(SYNCED_ENTITIES.length - 1),
  after: z
    .object({ xid: z.number().int().nonnegative(), id: z.uuid() })
    .nullable(),
});

export type PullPage = z.infer<typeof pullPage>;

export const pullInput = z.object({
  cursor: syncCursor.nullable(),
  page: pullPage.nullable().default(null),
  limit: z.number().int().min(1).max(PULL_PAGE_MAX).default(PULL_PAGE_DEFAULT),
  /** This app has a `department` table: a PWA of before would fail on its rows. */
  departments: z.literal(true).optional(),
});

export type PullInput = z.infer<typeof pullInput>;

/** A server row of one entity, without its organization; dates stay dates (superjson). */
export const pullChange = z.object({
  entity: syncedEntity,
  row: z.record(z.string(), z.unknown()).and(z.object({ id: z.uuid() })),
});

export type PullChange = z.infer<typeof pullChange>;

/**
 * `reset` says the cursor was unusable (another generation, beyond the
 * server's counter, or below the purge horizon): the rows start from the
 * beginning, and the device must take them all and drop what does not come
 * back. A later page may say it too, when a purge erased part of the range
 * meanwhile: the read has started over from zero. `cursor` is the next
 * cursor once `next` is null.
 */
export const pullOutput = z.object({
  generation: z.uuid(),
  reset: z.boolean(),
  rows: z.array(pullChange),
  next: pullPage.nullable(),
  cursor: z.number().int().nonnegative(),
});

export type PullOutput = z.infer<typeof pullOutput>;
