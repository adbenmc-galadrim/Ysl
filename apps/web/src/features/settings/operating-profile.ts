import {
  OPERATING_PROFILE_KEY,
  parseOperatingProfile,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import type { CourrierDatabase } from '#/features/db/schema';

/** This device's copy if it has one: none yet is not the same as a refusal. */
export async function readKeptProfile(
  db: CourrierDatabase,
): Promise<OperatingProfile | null> {
  const rows = await db.setting
    .where('key')
    .equals(OPERATING_PROFILE_KEY)
    .toArray();
  const row = rows.find((candidate) => !candidate.deletedAt);
  return row ? parseOperatingProfile(row.value) : null;
}

/** This device's copy, as the server wrote it: read offline, by the same rule as the server. */
export async function readOperatingProfile(
  db: CourrierDatabase,
): Promise<OperatingProfile> {
  const rows = await db.setting
    .where('key')
    .equals(OPERATING_PROFILE_KEY)
    .toArray();
  return parseOperatingProfile(rows.find((row) => !row.deletedAt)?.value);
}
