import { db } from '@repo/db';
import { env } from '@repo/shared/env/server';
import { COMPANY_SUSPENDED } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { authLogger } from '#auth-logger';
import { isInSuspendedCompany } from '#organization';
import { ac, roles } from '#roles';

export const CLIENT_IP_HEADER = 'x-client-ip';

const translate = createTranslator(DEFAULT_LOCALE);

const DAY_IN_SECONDS = 24 * 60 * 60;

export const auth = betterAuth({
  appName: 'Courrier',
  logger: authLogger,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg' }),
  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 30 * DAY_IN_SECONDS,
    updateAge: DAY_IN_SECONDS,
  },
  databaseHooks: {
    session: {
      create: {
        // After the password: it tells a suspended company only to whoever holds one of its accounts.
        before: async ({ userId }) => {
          if (await isInSuspendedCompany(db, userId)) {
            throw new APIError('FORBIDDEN', {
              code: COMPANY_SUSPENDED,
              message: translate('company.suspended.refused'),
            });
          }
        },
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === 'production',
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  plugins: [
    admin({
      ac,
      roles,
      // Accounts always name their role; a department attached nowhere reaches nothing.
      defaultRole: 'department',
      // The plugin wants one; `platform_admin` holds no admin statement (`roles.ts`), and the HTTP API is closed.
      adminRoles: ['platform_admin'],
    }),
  ],
});
