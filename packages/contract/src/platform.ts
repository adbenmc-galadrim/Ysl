import { z } from 'zod';
import { operatingProfile, PROFILE_MODELS } from './operating-profile';

/** Figures only (D26): nothing here may name a company, an account or a recipient. */
export const platformOverviewOutput = z.strictObject({
  companies: z.number().int().nonnegative(),
  suspendedCompanies: z.number().int().nonnegative(),
  accounts: z.number().int().nonnegative(),
  departments: z.number().int().nonnegative(),
  parcelsThisMonth: z.number().int().nonnegative(),
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
  /** Received since the first of the month, Paris time. */
  parcelsThisMonth: z.number().int().nonnegative(),
  /** A date and no more: what was done, and by whom, stays the company's. */
  lastActivityAt: z.date().nullable(),
});

export type PlatformCompany = z.infer<typeof platformCompany>;

export const platformCompanies = z.array(platformCompany);

/** The record adds what a deletion would erase, as a figure. */
export const platformCompanyDetail = platformCompany.extend({
  parcels: z.number().int().nonnegative(),
  /** How far it moved from its model, as a figure; none without a model. */
  changedSteps: z.number().int().nonnegative().nullable(),
});

export type PlatformCompanyDetail = z.infer<typeof platformCompanyDetail>;

export const companyInput = z.strictObject({ id: companyId });

export const createCompanyInput = z.strictObject({
  name: companyName,
  profileModel: z.enum(PROFILE_MODELS),
  /** The model as adjusted; complete or refused. A page of before sends none: the model's own. */
  profile: operatingProfile.optional(),
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

export const JOURNAL_ACTIONS = [
  'company_created',
  'company_renamed',
  'company_suspended',
  'company_reactivated',
  'company_deleted',
  'company_admin_invited',
  'company_admin_invite_refused',
] as const;

export type JournalAction = (typeof JOURNAL_ACTIONS)[number];

/**
 * What an action leaves besides its company: a model, a former name, figures.
 * Strict: no address, no employee's name, no reason typed by anyone (D26).
 */
export const journalDetail = z.strictObject({
  profileModel: z.enum(PROFILE_MODELS).optional(),
  previousName: z.string().optional(),
  accounts: z.number().int().nonnegative().optional(),
  departments: z.number().int().nonnegative().optional(),
  parcels: z.number().int().nonnegative().optional(),
});

export type JournalDetail = z.infer<typeof journalDetail>;

/** The actor is a platform account: nobody of a company ever appears here (D26). */
export const journalEntry = z.strictObject({
  id: z.uuid(),
  at: z.date(),
  action: z.enum(JOURNAL_ACTIONS),
  companyId: companyId,
  companyName: z.string(),
  actorName: z.string(),
  detail: journalDetail,
});

export type JournalEntry = z.infer<typeof journalEntry>;

export const JOURNAL_PERIODS = ['30d', '90d', '12m'] as const;

export type JournalPeriod = (typeof JOURNAL_PERIODS)[number];

export const JOURNAL_PAGE = 20;

export const journalInput = z.strictObject({
  action: z.enum(JOURNAL_ACTIONS).optional(),
  period: z.enum(JOURNAL_PERIODS).default('12m'),
  /** A part of the name at the time of the action, for a company deleted or renamed since. */
  query: z.string().trim().max(COMPANY_NAME_MAX).optional(),
  companyId: companyId.optional(),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(200).default(JOURNAL_PAGE),
});

export type JournalInput = z.input<typeof journalInput>;

export const journalOutput = z.strictObject({
  entries: z.array(journalEntry),
  total: z.number().int().nonnegative(),
});

export type JournalOutput = z.infer<typeof journalOutput>;

export const ACCOUNT_STANDINGS = [
  'suspended',
  'account_suspended',
  'active',
  'gone',
] as const;

/** Whether a phone that lost its session must keep what it holds, and nothing else of the account. */
export const accountSuspensionInput = z.strictObject({
  userId: z.string().min(1).max(200),
});

export const accountSuspensionOutput = z.strictObject({
  standing: z.enum(ACCOUNT_STANDINGS),
  reactivatedAt: z.date().nullable(),
});
