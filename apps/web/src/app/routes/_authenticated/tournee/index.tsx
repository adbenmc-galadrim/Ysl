import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useGoesOnTour } from '#/features/parcels/api/use-tour';
import { TourPage } from '#/features/parcels/components/tour-page';

/** A shuttle acting as department has no tour: Colis is its work. */
function TourRoute() {
  const tour = useGoesOnTour();
  if (tour === undefined) return null;
  return tour ? <TourPage /> : <Navigate to="/" replace />;
}

export const Route = createFileRoute('/_authenticated/tournee/')({
  component: TourRoute,
});
