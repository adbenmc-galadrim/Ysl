import { z } from 'zod';

export const USER_ROLES = [
  'agent',
  'admin',
  'platform_admin',
  'company_admin',
  'department',
  'shuttle',
] as const;

export const DEFAULT_USER_ROLE = 'agent';

export const userRole = z.enum(USER_ROLES);

export type UserRole = z.infer<typeof userRole>;

export function toUserRole(value: unknown): UserRole {
  const parsed = userRole.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_USER_ROLE;
}

/** `admin` is the account of before the conversion: it stays a company admin until then. */
export function isCompanyAdmin(role: UserRole): boolean {
  return role === 'company_admin' || role === 'admin';
}

/** Reaches the data of the whole company; a department only ever gets its own. */
export function seesWholeCompany(role: UserRole): boolean {
  return role !== 'department' && role !== 'platform_admin';
}

/**
 * A shuttle hands over only when the profile makes it act as a department
 * (§2.1). The profile comes with YSL-124, which replaces this answer.
 */
const SHUTTLE_ACTS_AS_DEPARTMENT = false;

/** Gives a parcel to an employee (§2.1); `admin` and `agent` still do, until the conversion. */
export function canHandOver(role: UserRole): boolean {
  if (role === 'shuttle') return SHUTTLE_ACTS_AS_DEPARTMENT;
  return role === 'department' || role === 'admin' || role === 'agent';
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
