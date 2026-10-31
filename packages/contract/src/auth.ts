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

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 128;

export const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);
