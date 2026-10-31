import {
  EMPTY_COMPANY_SETTINGS,
  resolveRetention,
  type CompanyReception,
  type CompanySettings,
  type ResolvedRetention,
} from '@repo/contract/company-settings';

let current: CompanySettings = EMPTY_COMPANY_SETTINGS;

/** The last copy read on this device: the rules that use it are synchronous. */
export function setCompanySnapshot(settings: CompanySettings): void {
  current = settings;
}

export const currentRetention = (): ResolvedRetention =>
  resolveRetention(current.retention);

export const currentReception = (): CompanyReception | null =>
  current.reception ?? null;
