import { createFileRoute } from '@tanstack/react-router';
import { OnTourOnly } from '#/features/parcels/components/on-tour-only';
import { TourStopPage } from '#/features/parcels/components/tour-stop-page';

function TourStopRoute() {
  const { departmentId } = Route.useParams();
  return (
    <OnTourOnly>
      <TourStopPage departmentId={departmentId} />
    </OnTourOnly>
  );
}

export const Route = createFileRoute('/_authenticated/tournee/$departmentId')({
  component: TourStopRoute,
});
