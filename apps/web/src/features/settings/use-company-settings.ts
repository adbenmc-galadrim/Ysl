import {
  EMPTY_COMPANY_SETTINGS,
  logoPath,
  type CompanySettings,
} from '@repo/contract/company-settings';
import { env } from '@repo/shared/env/web';
import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { readCompanySettings } from '#/features/settings/company-settings';
import { setCompanySnapshot } from '#/features/settings/company-snapshot';

export function useCompanySettings(): CompanySettings {
  return (
    useLiveQuery(() => readCompanySettings(db), []) ?? EMPTY_COMPANY_SETTINGS
  );
}

/** Keeps the synchronous copy up to date, for as long as the app runs. */
export function startCompanySettings(): void {
  liveQuery(() => readCompanySettings(db)).subscribe({
    next: setCompanySnapshot,
  });
}

/** Absent, the screens draw the neutral initials (D14). */
export const logoUrl = (
  logoId: string | null | undefined,
): string | undefined =>
  logoId ? `${env.PUBLIC_SERVER_URL}${logoPath(logoId)}` : undefined;
