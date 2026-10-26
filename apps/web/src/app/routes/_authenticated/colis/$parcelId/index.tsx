import { createFileRoute } from '@tanstack/react-router';
import { ParcelRecordView } from '#/features/parcels/components/parcel-record';

export const Route = createFileRoute('/_authenticated/colis/$parcelId/')({
  component: ParcelRecordPage,
});

function ParcelRecordPage() {
  const { parcelId } = Route.useParams();
  return <ParcelRecordView key={parcelId} parcelId={parcelId} />;
}
