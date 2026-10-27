import { createFileRoute } from '@tanstack/react-router';
import { DamageReportView } from '#/features/damage/components/damage-report';

export const Route = createFileRoute('/_authenticated/colis/$parcelId/dommage')(
  {
    component: DamageReportPage,
  },
);

function DamageReportPage() {
  const { parcelId } = Route.useParams();
  return <DamageReportView key={parcelId} parcelId={parcelId} />;
}
