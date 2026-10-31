import { toUserRole } from '@repo/contract/auth';
import { useSession } from '#/features/auth/api/use-session';
import { receives } from '#/features/auth/route-access';
import { ReprendreLot } from '#/features/batch/components/reprendre-lot';
import { ColisHome } from '#/features/parcels/components/colis-home';

/** The list of parcels, and for whoever scans labels, the batch left open. */
export function ColisPage() {
  const session = useSession();
  return (
    <>
      <ColisHome />
      {receives(toUserRole(session.user.role)) && <ReprendreLot />}
    </>
  );
}
