import { signOut } from '@repo/auth/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { forgetSession } from '#/features/auth/session-cache';
import { clearLocalData } from '#/features/db/clear';
import { db } from '#/features/db/database';
import { resetOfflinePrep } from '#/features/offline/prep';
import { forgetPrepared } from '#/features/offline/prepared';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import {
  prepareSignOut,
  SignOutBlockedError,
} from '#/features/sync/sign-out-guard';
import { stopSync, syncNow } from '#/features/sync/sync';

export { SignOutBlockedError };

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      discardRejected = false,
    }: { discardRejected?: boolean } = {}) => {
      const check = await prepareSignOut(db, () => syncNow({ force: true }), {
        discardRejected,
      });
      if (!check.ok) {
        throw new SignOutBlockedError(check.pending, check.rejected);
      }
      const { error } = await signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      forgetSession(localStorage);
      forgetPrepared(localStorage);
      resetOfflinePrep();
      await stopSync();
      try {
        await clearLocalData(db, hasPhotoStorage() ? photoFiles : null);
      } catch (cause) {
        console.warn('Local data was not fully cleared', cause);
      }
      queryClient.clear();
      await router.navigate({ to: '/connexion', search: {} });
    },
  });
}
