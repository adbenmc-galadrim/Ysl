import { signOut } from '@repo/auth/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { forgetSession } from '#/features/auth/session-cache';
import { wipeLocalData } from '#/features/auth/wipe';
import { db } from '#/features/db/database';
import {
  prepareSignOut,
  SignOutBlockedError,
} from '#/features/sync/sign-out-guard';
import { syncNow } from '#/features/sync/sync';

export { SignOutBlockedError };

/**
 * What leaving the session does to the device: forget the session, stop the
 * synchronisation, empty Dexie and OPFS, and go back to sign-in.
 */
function useWipeDevice() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async () => {
    await wipeLocalData();
    queryClient.clear();
    await router.navigate({ to: '/connexion', search: {} });
  };
}

export function useSignOut() {
  const wipe = useWipeDevice();

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
      forgetSession(localStorage);
      const { error } = await signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: wipe,
  });
}

/**
 * "Effacer les données de cet iPhone" (§9.1): the sign-out, except that the
 * admin may give up every change still on the phone, queued or refused,
 * once told how many. The session is closed on the server first: a wipe
 * that kept the cookie would pull everything back at the next launch.
 */
export function useEraseDevice() {
  const wipe = useWipeDevice();

  return useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      if (!force) {
        const check = await prepareSignOut(db, () => syncNow({ force: true }));
        if (!check.ok) {
          throw new SignOutBlockedError(check.pending, check.rejected);
        }
      }
      forgetSession(localStorage);
      const { error } = await signOut();
      if (error) throw new Error(error.message);
    },
    onSuccess: wipe,
  });
}
