import { signOut } from '@repo/auth/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const { error } = await signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      queryClient.clear();
      await router.navigate({ to: '/connexion', search: {} });
    },
  });
}
