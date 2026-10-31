import { z } from 'zod';

export type RetentionUnit = 'day' | 'month';

export type RetentionDuration = { amount: number; unit: RetentionUnit };

/**
 * How long each record lives (§9.2, validated by the DPO: D7). The server
 * purges its tables, every iPhone purges its own copy and its photos.
 */
export const RETENTION = {
  /**
   * A label or damage photo, once its parcel has left the counter (handed
   * over or returned) and the server holds its row: the photo itself never
   * leaves the iPhone (D8), so "sent" reads as "its parcel is settled".
   */
  photo: { amount: 7, unit: 'day' },
  /** A signature photo, from the handover it proves. */
  signature: { amount: 12, unit: 'month' },
  /** What the reader made of a label: OCR text, raw codes (`extraction`). */
  extraction: { amount: 30, unit: 'day' },
  /** A parcel after its handover or return, with its events, handovers and notifications. */
  parcel: { amount: 12, unit: 'month' },
  /** A contact outside the directory, after it was last used. */
  contact: { amount: 12, unit: 'month' },
  /** A person of the directory who left (`active = false`), kept this long in case of a mistake. */
  inactivePerson: { amount: 30, unit: 'day' },
  /**
   * A row marked deleted stays this long before it is erased, so that every
   * iPhone pulls the mark; one further behind starts over (`reset`).
   */
  tombstone: { amount: 30, unit: 'day' },
  /** The log of pushed operations: it answers a resent operation, and keeps the conflicts. */
  syncOp: { amount: 90, unit: 'day' },
  /** A server e-mail once sent or given up: its address and text (not in D7, to validate). */
  emailOutbox: { amount: 30, unit: 'day' },
} as const satisfies Record<string, RetentionDuration>;

export type RetentionKey = keyof typeof RETENTION;

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The instant `duration` before `now`: anything older is past its time.
 * Months are calendar months, and the 31st falls back to the month's last
 * day (31 March − 1 month = 28 or 29 February).
 */
export function cutoff(now: Date, duration: RetentionDuration): Date {
  if (duration.unit === 'day') {
    return new Date(now.getTime() - duration.amount * 24 * 60 * 60 * 1000);
  }
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - duration.amount;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = Math.min(now.getUTCDate(), daysIn(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}

/** The tables a purge marks or erases, children before parents. */
export const PURGE_TABLES = [
  'handover',
  'deposit',
  'notification',
  'pickup_code',
  'event',
  'parcel',
  'batch',
  'sender_account',
  'sender_alias',
  'sender',
  'email_template',
  'setting',
  'recipient_alias',
  'contact',
  'directory_person',
  'sync_op',
] as const;

export type PurgeTable = (typeof PURGE_TABLES)[number];

const count = z.number().int().nonnegative();

/** Rows marked `deleted_at` by this run, and rows erased for good. */
export const purgeTableCount = z.object({ marked: count, deleted: count });

export type PurgeTableCount = z.infer<typeof purgeTableCount>;

export const purgeCounts = z.partialRecord(
  z.enum(PURGE_TABLES),
  purgeTableCount,
);

export type PurgeCounts = z.infer<typeof purgeCounts>;

export const PURGE_TRIGGERS = ['auto', 'manual'] as const;

export type PurgeTrigger = (typeof PURGE_TRIGGERS)[number];

export const purgeRun = z.object({
  trigger: z.enum(PURGE_TRIGGERS),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  counts: purgeCounts,
});

export type PurgeRun = z.infer<typeof purgeRun>;

/** `busy`: another run holds the lock (the scheduled one, or another instance). */
export const purgeNowOutput = z.discriminatedUnion('status', [
  z.object({ status: z.literal('done'), run: purgeRun }),
  z.object({ status: z.literal('busy') }),
]);

export type PurgeNowOutput = z.infer<typeof purgeNowOutput>;

export const purgeStatusOutput = z.object({
  /** The last run that finished for this mailroom, scheduled or by hand. */
  last: purgeRun.nullable(),
});

export type PurgeStatusOutput = z.infer<typeof purgeStatusOutput>;

/** Rows marked and erased, all tables together, and the parcels among them. */
export function purgeTotals(counts: PurgeCounts): {
  parcels: number;
  contacts: number;
  rows: number;
} {
  let rows = 0;
  for (const table of PURGE_TABLES) {
    const entry = counts[table];
    if (entry) rows += entry.marked + entry.deleted;
  }
  return {
    parcels: counts.parcel?.marked ?? 0,
    contacts:
      (counts.contact?.marked ?? 0) + (counts.directory_person?.marked ?? 0),
    rows,
  };
}
