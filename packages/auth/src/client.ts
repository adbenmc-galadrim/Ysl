import { env } from '@repo/shared/env/web';
import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { ac, roles } from '#roles';

export const authClient = createAuthClient({
  baseURL: env.PUBLIC_SERVER_URL,
  fetchOptions: { credentials: 'include' },
  plugins: [
    adminClient({ ac, roles }),
    inferAdditionalFields({
      user: {
        passwordChangeRequiredAt: { type: 'date', required: false, input: false },
      },
    }),
  ],
});

export const { signIn, signOut, useSession, getSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = Session['user'];
