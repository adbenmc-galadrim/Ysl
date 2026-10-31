import { canWriteDirectory, toUserRole } from '@repo/contract/auth';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import {
  type AccountRole,
  handsOver,
  receives,
} from '#/features/auth/route-access';
import { db } from '#/features/db/database';
import { readKeptProfile } from '#/features/settings/operating-profile';

export type AccessView = {
  role: AccountRole;
  receives: boolean;
  handsOver: boolean;
  /** A role this version does not know writes on the parcel: it always goes through. */
  writesDirectory: boolean;
};

/**
 * What this account does on this device, to hide what the server would refuse:
 * a refused write goes to « Corriger », with no way to correct it.
 */
export function useAccess(): AccessView {
  const session = useSession();
  const role = toUserRole(session.user.role);
  const profile = useLiveQuery(
    () => (role === 'shuttle' ? readKeptProfile(db) : null),
    [role],
  );
  return {
    role,
    receives: receives(role),
    handsOver: handsOver(role, profile ?? null),
    writesDirectory: role !== null && canWriteDirectory(role),
  };
}
