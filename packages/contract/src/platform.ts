import { z } from 'zod';
import { PROFILE_MODELS } from './operating-profile';

/** Figures only (D26): nothing here may name a company, an account or a recipient. */
export const platformOverviewOutput = z.strictObject({
  companies: z.number().int().nonnegative(),
});

export type PlatformOverviewOutput = z.infer<typeof platformOverviewOutput>;

export const COMPANY_NAME_MAX = 80;

const companyName = z.string().trim().min(1).max(COMPANY_NAME_MAX);
const companyId = z.uuid();

/**
 * What the app's admin sees of a client (D26): its name and figures. Strict, so
 * an account's name or a directory field added here fails instead of leaking.
 */
export const platformCompany = z.strictObject({
  id: companyId,
  name: z.string(),
  createdAt: z.date(),
  suspendedAt: z.date().nullable(),
  profileModel: z.enum(PROFILE_MODELS).nullable(),
  departments: z.number().int().nonnegative(),
  accounts: z.number().int().nonnegative(),
});

export type PlatformCompany = z.infer<typeof platformCompany>;

export const platformCompanies = z.array(platformCompany);

/** The record adds what a deletion would erase, as a figure. */
export const platformCompanyDetail = platformCompany.extend({
  parcels: z.number().int().nonnegative(),
});

export type PlatformCompanyDetail = z.infer<typeof platformCompanyDetail>;

export const companyInput = z.strictObject({ id: companyId });

export const createCompanyInput = z.strictObject({
  name: companyName,
  profileModel: z.enum(PROFILE_MODELS),
});

export const renameCompanyInput = z.strictObject({
  id: companyId,
  name: companyName,
});

/** The name typed again: an irreversible act is not one click, nor a stale tab's. */
export const deleteCompanyInput = z.strictObject({
  id: companyId,
  confirmName: z.string(),
});

export const ACCOUNT_STANDINGS = ['suspended', 'active', 'gone'] as const;

/** Whether a phone that lost its session must keep what it holds, and nothing else of the account. */
export const accountSuspensionInput = z.strictObject({
  userId: z.string().min(1).max(200),
});

export const accountSuspensionOutput = z.strictObject({
  standing: z.enum(ACCOUNT_STANDINGS),
  reactivatedAt: z.date().nullable(),
});
