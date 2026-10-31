import {
  OPERATING_PROFILE_KEY,
  parseOperatingProfile,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import type { CourrierDatabase } from '#/features/db/schema';

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
