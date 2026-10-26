import {
  EMPTY_PICKUP,
  parsePickup,
  PICKUP_DAYS,
  type PickupSetting,
  type SettingKey,
} from '@repo/contract/settings';
import { newId } from '@repo/shared/id';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalSetting } from '#/features/db/schema';

export const PICKUP_KEY = 'pickup' satisfies SettingKey;

const fromServer = (row: LocalSetting) => row.serverXid !== undefined;

/**
 * The mailroom's pickup row, as synced to this iPhone: read offline, and
 * kept the same row across saves so the server's one-row-per-key rule holds.
 * Two iPhone that each created it offline both hold a row; the server keeps
 * the first pushed and refuses the other (409), which never gets a
 * `serverXid`. The row the server sent back wins, so the next save goes to it.
 */
async function pickupRow(
  db: CourrierDatabase,
): Promise<LocalSetting | undefined> {
  const rows = await db.setting.where('key').equals(PICKUP_KEY).toArray();
  return rows
    .filter((row) => !row.deletedAt)
    .sort(
      (a, b) =>
        Number(fromServer(b)) - Number(fromServer(a)) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
}

export async function readPickup(db: CourrierDatabase): Promise<PickupSetting> {
  return parsePickup((await pickupRow(db))?.value);
}

/** What the e-mails will quote: no stray spaces around a line. */
export function tidyPickup(value: PickupSetting): PickupSetting {
  return {
    place: value.place.trim(),
    hours: Object.fromEntries(
      PICKUP_DAYS.map((day) => [day, value.hours[day].trim()]),
    ) as PickupSetting['hours'],
    instructions: value.instructions.trim(),
  };
}

const same = (a: PickupSetting, b: PickupSetting) =>
  JSON.stringify(a) === JSON.stringify(b);

export type SavePickupOptions = { userId: string; now?: Date };

/**
 * Saves the pickup local first, queued for `sync.push`; nothing is written
 * when the screen is left as it was found.
 */
export async function savePickup(
  db: CourrierDatabase,
  value: PickupSetting,
  { userId, now = new Date() }: SavePickupOptions,
): Promise<'saved' | 'unchanged'> {
  const existing = await pickupRow(db);
  const next = tidyPickup(value);
  if (same(next, existing ? parsePickup(existing.value) : EMPTY_PICKUP)) {
    return 'unchanged';
  }
  const row: LocalSetting = {
    ...(existing ?? {
      id: newId(),
      createdAt: now,
      deletedAt: null,
      key: PICKUP_KEY,
    }),
    value: next,
    updatedAt: now,
    updatedBy: userId,
  };
  await commitLocal(db, { upserts: [{ entity: 'setting', row }] }, { now });
  return 'saved';
}
