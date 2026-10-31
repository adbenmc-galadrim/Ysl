import { toUserRole } from '@repo/contract/auth';
import { useSession } from '#/features/auth/api/use-session';
import { receives } from '#/features/auth/route-access';
import { ReprendreLot } from '#/features/batch/components/reprendre-lot';
import { ColisHome } from '#/features/parcels/components/colis-home';
import { useOnDesk } from '#/features/shell/components/use-work-path';

/** The list of parcels, and for whoever scans labels, the batch left open. */
export function ColisPage() {
  const session = useSession();
  const role = toUserRole(session.user.role);
  const onDesk = useOnDesk();
  // The scan is on the phone (D23): nothing to resume from a computer role's desk.
  const scansHere = receives(role) && !onDesk;
  return (
    <>
      <ColisHome />
      {scansHere && <ReprendreLot />}
    </>
  );
}
