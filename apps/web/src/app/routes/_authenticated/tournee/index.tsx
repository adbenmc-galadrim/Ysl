import { createFileRoute } from '@tanstack/react-router';
import { OnTourOnly } from '#/features/parcels/components/on-tour-only';
import { TourPage } from '#/features/parcels/components/tour-page';

export const Route = createFileRoute('/_authenticated/tournee/')({
  component: () => (
    <OnTourOnly>
      <TourPage />
    </OnTourOnly>
  ),
});
