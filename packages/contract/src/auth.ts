import { z } from 'zod';

export const USER_ROLES = ['agent', 'admin'] as const;

export const DEFAULT_USER_ROLE = 'agent';

export const userRole = z.enum(USER_ROLES);

export type UserRole = z.infer<typeof userRole>;

export function toUserRole(value: unknown): UserRole {
  const parsed = userRole.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_USER_ROLE;
}
