import {
  COMPANY_SETTINGS_KEY,
  EMPTY_COMPANY_SETTINGS,
  parseCompanySettings,
  type CompanySettings,
} from '@repo/contract/company-settings';
import type { CourrierDatabase } from '#/features/db/schema';

/** This device's copy, as the server wrote it; none yet keeps every default. */
export async function readCompanySettings(
  db: CourrierDatabase,
): Promise<CompanySettings> {
  const rows = await db.setting
    .where('key')
    .equals(COMPANY_SETTINGS_KEY)
    .toArray();
  const row = rows.find((candidate) => !candidate.deletedAt);
  return row ? parseCompanySettings(row.value) : EMPTY_COMPANY_SETTINGS;
}
