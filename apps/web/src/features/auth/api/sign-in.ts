import { signIn } from '@repo/auth/client';
import { COMPANY_SUSPENDED } from '@repo/contract/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '#/features/auth/api/session';

export type SignInFailure =
  | 'invalid'
  | 'suspended'
  | 'rateLimited'
  | 'network'
  | 'unknown';

export class SignInError extends Error {
  constructor(readonly failure: SignInFailure) {
    super(failure);
  }
}

function classify(error: { status?: number; code?: string }): SignInFailure {
  if (error.status === 429) return 'rateLimited';
  if (error.code === COMPANY_SUSPENDED) return 'suspended';
  // A deactivated account gets the same message, so it reveals nothing.
  if (
    error.code === 'INVALID_EMAIL_OR_PASSWORD' ||
    error.code === 'BANNED_USER'
  ) {
    return 'invalid';
  }
  if (!error.status) return 'network';
  return 'unknown';
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      let result;
      try {
        result = await signIn.email(credentials);
      } catch {
        throw new SignInError('network');
      }
      if (result.error) throw new SignInError(classify(result.error));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey }),
  });
}
