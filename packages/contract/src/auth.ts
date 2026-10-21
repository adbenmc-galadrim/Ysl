import { z } from 'zod';

export const USER_ROLES = ['agent', 'admin'] as const;

export const DEFAULT_USER_ROLE = 'agent';

export const userRole = z.enum(USER_ROLES);

export type UserRole = z.infer<typeof userRole>;

export function toUserRole(value: unknown): UserRole {
  const parsed = userRole.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_USER_ROLE;
}

export const MIN_PASSWORD_LENGTH = 8;

export const MAX_PASSWORD_LENGTH = 128;

export const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);
