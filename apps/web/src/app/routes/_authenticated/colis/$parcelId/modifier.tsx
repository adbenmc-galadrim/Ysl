import { createFileRoute } from '@tanstack/react-router';
import { ParcelEditView } from '#/features/parcels/components/parcel-edit';

export const Route = createFileRoute(
  '/_authenticated/colis/$parcelId/modifier',
)({
  component: ParcelEditPage,
});

function ParcelEditPage() {
  const { parcelId } = Route.useParams();
  return <ParcelEditView key={parcelId} parcelId={parcelId} />;
}
