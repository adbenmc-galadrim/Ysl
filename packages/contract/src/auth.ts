import { z } from 'zod';
import type { OperatingProfile } from './operating-profile';

export const USER_ROLES = [
  'platform_admin',
  'company_admin',
  'department',
  'shuttle',
] as const;

export const userRole = z.enum(USER_ROLES);

export type UserRole = z.infer<typeof userRole>;

/** Nothing for a role this version does not know: it reaches nothing, it does not get a default. */
export function toUserRole(value: unknown): UserRole | null {
  const parsed = userRole.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isCompanyAdmin(role: UserRole | null): boolean {
  return role === 'company_admin';
}

/** Reaches the data of the whole company; a department only ever gets its own. */
export function seesWholeCompany(role: UserRole): boolean {
  return role !== 'department' && role !== 'platform_admin';
}

/** Gives a parcel to an employee (§2.1): the shuttle when the profile makes it act as a department. */
export function canHandOver(
  role: UserRole,
  profile: Pick<OperatingProfile, 'shuttleActsAsDepartment'>,
): boolean {
  if (role === 'shuttle') return profile.shuttleActsAsDepartment;
  return role === 'department';
}

/** Writes the directory (D15 révisée): the shuttle only reads it. */
export function canWriteDirectory(role: UserRole): boolean {
  return role !== 'shuttle' && role !== 'platform_admin';
}

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 128;

export const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);

/** Why a suspended company's account is refused, at sign-in and on the API alike. */
export const COMPANY_SUSPENDED = 'COMPANY_SUSPENDED';
