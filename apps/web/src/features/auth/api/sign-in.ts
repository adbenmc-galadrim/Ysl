import { signIn } from '@repo/auth/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionQueryOptions } from '#/features/auth/api/session';
import { classify, type SignInFailure } from '#/features/auth/sign-in-failure';

export type { SignInFailure };

export class SignInError extends Error {
  constructor(readonly failure: SignInFailure) {
    super(failure);
  }
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
