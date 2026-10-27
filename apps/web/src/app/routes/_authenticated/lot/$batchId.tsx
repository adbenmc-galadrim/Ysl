import { createFileRoute } from '@tanstack/react-router';
import { LotEnregistrePage } from '#/features/batch/components/lot-enregistre-page';

export const Route = createFileRoute('/_authenticated/lot/$batchId')({
  component: LotEnregistreRoute,
});

function LotEnregistreRoute() {
  const { batchId } = Route.useParams();
  return <LotEnregistrePage key={batchId} batchId={batchId} />;
}
