import { toUserRole } from '@repo/contract/auth';
import { useSession } from '#/features/auth/api/use-session';
import { hasDesk } from '#/features/auth/route-access';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

/** A computer role on a computer, whose `/` is its own space rather than the work. */
export function useOnDesk(): boolean {
  const session = useSession();
  const desk = useMediaQuery(DESK_WIDTH);
  return desk && hasDesk(toUserRole(session.user.role));
}

/** Where leaving a parcel's screen leads: the list of parcels, whichever path holds it. */
export function useWorkPath(): '/' | '/colis' {
  return useOnDesk() ? '/colis' : '/';
}
