import { z } from 'zod';
import { password, userRole } from './auth';

const userId = z.string().min(1);
const departmentId = z.uuid();

export const ACCOUNT_STATES = ['active', 'suspended', 'revoked'] as const;
export const accountState = z.enum(ACCOUNT_STATES);
export type AccountState = z.infer<typeof accountState>;

/** `user.ban_reason` tells them apart; both refuse sign-in, only a revocation closes the sessions. */
export const BAN_REASON = {
  suspended: 'suspended',
  revoked: 'revoked',
} as const;

export function accountStateOf(user: {
  banned?: boolean | null;
  banReason?: string | null;
}): AccountState {
  if (!user.banned) return 'active';
  return user.banReason === BAN_REASON.revoked ? 'revoked' : 'suspended';
}

export const accountRecord = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRole.nullable(),
  departmentId: z.string().nullable(),
  departmentName: z.string().nullable(),
  state: accountState,
  lastSignInAt: z.date().nullable(),
  deviceAgents: z.array(z.string().nullable()),
});
export type AccountRecord = z.infer<typeof accountRecord>;

export const ACCOUNTS_PAGE_SIZE = 50;

export const listAccountsInput = z.object({
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(100).default(ACCOUNTS_PAGE_SIZE),
  role: userRole.exclude(['platform_admin']).optional(),
  departmentId: departmentId.optional(),
  state: accountState.optional(),
  search: z.string().trim().max(200).optional(),
});
export type ListAccountsInput = z.input<typeof listAccountsInput>;

export const listAccountsOutput = z.object({
  rows: z.array(accountRecord),
  /** What the filters match, across all pages. */
  total: z.number(),
  /** The company, whatever the filters: the tabs' figures. */
  counts: z.object({
    all: z.number(),
    shuttle: z.number(),
    department: z.number(),
    company_admin: z.number(),
  }),
});
export type ListAccountsOutput = z.infer<typeof listAccountsOutput>;

const withDepartment = <
  T extends { role: string; departmentId: string | null },
>(
  value: T,
) => (value.role === 'department') === (value.departmentId !== null);

const DEPARTMENT_RULE = {
  path: ['departmentId'],
  message: 'A department account has a department; no other role has one.',
};

export const createAccountInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.email().transform((value) => value.toLowerCase()),
    password,
    // Never `platform_admin`: this route must not be able to hand it out.
    role: z.enum(['shuttle', 'department', 'company_admin']),
    departmentId: departmentId.nullable(),
  })
  .refine(withDepartment, DEPARTMENT_RULE);
export type CreateAccountInput = z.input<typeof createAccountInput>;

export const setAccountRoleInput = z
  .object({
    userId,
    role: z.enum(['shuttle', 'department']),
    departmentId: departmentId.nullable(),
  })
  .refine(withDepartment, DEPARTMENT_RULE);
export type SetAccountRoleInput = z.input<typeof setAccountRoleInput>;

export const accountTargetInput = z.object({ userId });

export const reinstateAccountInput = z.object({
  userId,
  /** Required after a revocation: the old password may be why it happened. */
  password: password.optional(),
});
export type ReinstateAccountInput = z.input<typeof reinstateAccountInput>;

export const resetAccountPasswordInput = z.object({
  userId,
  password,
  /** Signs every device out, which empties the phones: for a compromised password. */
  closeSessions: z.boolean().default(false),
});
export type ResetAccountPasswordInput = z.input<
  typeof resetAccountPasswordInput
>;
