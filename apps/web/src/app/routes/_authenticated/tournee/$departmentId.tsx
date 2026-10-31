import { createFileRoute } from '@tanstack/react-router';
import { TourStopPage } from '#/features/parcels/components/tour-stop-page';

function TourStopRoute() {
  const { departmentId } = Route.useParams();
  return <TourStopPage departmentId={departmentId} />;
}

export const Route = createFileRoute('/_authenticated/tournee/$departmentId')({
  component: TourStopRoute,
});
