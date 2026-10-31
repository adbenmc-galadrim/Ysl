import { auth, isAPIError } from '@repo/auth';
import { DEFAULT_USER_ROLE, toUserRole } from '@repo/contract/auth';
import type { Agent, CreateAgentInput } from '@repo/contract/agents';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';

const translate = createTranslator(DEFAULT_LOCALE);

const EMAIL_TAKEN = 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL';
const LIST_LIMIT = 200;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  createdAt: Date;
}

function toAgent(user: AuthUser): Agent {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: toUserRole(user.role),
    active: !user.banned,
    createdAt: user.createdAt.toISOString(),
  };
}

function isPlatformAccount(user: { role?: string | null }): boolean {
  return toUserRole(user.role) === 'platform_admin';
}

/** An app admin is nobody's agent: a company admin must not be able to take the account. */
async function refusePlatformAccount(
  headers: Headers,
  userId: string,
): Promise<void> {
  const target = await auth.api.getUser({ headers, query: { id: userId } });
  // No `role` at all means Better Auth stopped sending it: refuse rather than read it as an agent.
  if (target.role === undefined || isPlatformAccount(target)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: translate('agents.error.notFound'),
    });
  }
}

async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isAPIError(error)) throw error;
    if (error.body?.code === EMAIL_TAKEN) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: translate('agents.error.emailTaken'),
      });
    }
    if (error.status === 'NOT_FOUND') {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: translate('agents.error.notFound'),
      });
    }
    if (error.status === 'BAD_REQUEST') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: translate('agents.error.invalid'),
      });
    }
    throw error;
  }
}

export async function listAgents(headers: Headers): Promise<Agent[]> {
  const { users } = await guarded(() =>
    auth.api.listUsers({
      headers,
      query: { limit: LIST_LIMIT, sortBy: 'createdAt', sortDirection: 'desc' },
    }),
  );
  return users.filter((user) => !isPlatformAccount(user)).map(toAgent);
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const { user } = await guarded(() =>
    auth.api.createUser({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role ?? DEFAULT_USER_ROLE,
      },
    }),
  );
  return toAgent(user);
}

export async function setAgentActive(
  headers: Headers,
  input: { userId: string; active: boolean },
): Promise<void> {
  await guarded(async () => {
    await refusePlatformAccount(headers, input.userId);
    if (input.active) {
      await auth.api.unbanUser({ headers, body: { userId: input.userId } });
      return;
    }
    await auth.api.banUser({ headers, body: { userId: input.userId } });
    await auth.api.revokeUserSessions({
      headers,
      body: { userId: input.userId },
    });
  });
}

export async function resetAgentPassword(
  headers: Headers,
  input: { userId: string; password: string },
): Promise<void> {
  await guarded(async () => {
    await refusePlatformAccount(headers, input.userId);
    await auth.api.setUserPassword({
      headers,
      body: { userId: input.userId, newPassword: input.password },
    });
    await auth.api.revokeUserSessions({
      headers,
      body: { userId: input.userId },
    });
  });
}
