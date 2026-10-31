import {
  COMPANY_SETTINGS_KEY,
  parseCompanySettings,
  type CompanySettings,
} from '@repo/contract/company-settings';
import type { AnyDb } from '@repo/db';
import { setting } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, eq, isNull, sql } from 'drizzle-orm';

/** A company with no row keeps every default (D28, §3.7.9). */
export async function readCompanySettings(
  db: AnyDb,
  organizationId: string,
): Promise<CompanySettings> {
  const [row] = await db
    .select({ value: setting.value })
    .from(setting)
    .where(
      and(
        eq(setting.organizationId, organizationId),
        eq(setting.key, COMPANY_SETTINGS_KEY),
        isNull(setting.deletedAt),
      ),
    );
  return parseCompanySettings(row?.value);
}

/**
 * Writes the given parts of the company's row, the others untouched: two
 * admins on two tabs do not undo each other. The synchronisation takes it to
 * the devices.
 */
export async function writeCompanySettings(
  db: AnyDb,
  organizationId: string,
  patch: CompanySettings,
  updatedBy: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .insert(setting)
    .values({
      id: newId(),
      organizationId,
      key: COMPANY_SETTINGS_KEY,
      value: patch,
      updatedBy,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [setting.organizationId, setting.key],
      targetWhere: sql`${setting.deletedAt} is null`,
      set: {
        value: sql`${setting.value} || ${JSON.stringify(patch)}::jsonb`,
        updatedBy,
        updatedAt: now,
      },
    });
}
