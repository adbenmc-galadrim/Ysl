import { toUserRole } from '@repo/contract/auth';
import { useSession } from '#/features/auth/api/use-session';
import { hasDesk } from '#/features/auth/route-access';
import { DashboardHome } from '#/features/dashboard/components/dashboard-home';
import { DepartmentSpaceDesk } from '#/features/department-space/components/department-space-desk';
import { useGoesOnTour } from '#/features/parcels/api/use-tour';
import { ColisPage } from '#/features/parcels/components/colis-page';
import { TourPage } from '#/features/parcels/components/tour-page';
import { CompaniesPage } from '#/features/platform/components/companies-page';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

/** With tours, the shuttle opens on its round; acting as department, on Colis as ever. */
function ShuttleHome() {
  const tour = useGoesOnTour();
  if (tour === undefined) return null;
  return tour ? <TourPage /> : <ColisPage />;
}

/** `/`, by role: a computer role on a computer opens on its space, everyone else on the work. */
export function HomePage() {
  const session = useSession();
  const role = toUserRole(session.user.role);
  const desk = useMediaQuery(DESK_WIDTH);
  if (role === 'platform_admin') return <CompaniesPage />;
  if (desk && hasDesk(role)) {
    return role === 'department' ? <DepartmentSpaceDesk /> : <DashboardHome />;
  }
  return role === 'shuttle' ? <ShuttleHome /> : <ColisPage />;
}
