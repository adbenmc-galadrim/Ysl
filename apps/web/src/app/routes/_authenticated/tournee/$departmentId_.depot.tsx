import { createFileRoute } from '@tanstack/react-router';
import { OnTourOnly } from '#/features/parcels/components/on-tour-only';
import { TourDepositPage } from '#/features/parcels/components/tour-deposit-page';

function TourDepositRoute() {
  const { departmentId } = Route.useParams();
  return (
    <OnTourOnly>
      <TourDepositPage departmentId={departmentId} />
    </OnTourOnly>
  );
}

export const Route = createFileRoute(
  '/_authenticated/tournee/$departmentId_/depot',
)({
  component: TourDepositRoute,
});
