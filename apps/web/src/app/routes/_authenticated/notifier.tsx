import { createFileRoute } from '@tanstack/react-router';
import { NotifierPage } from '#/features/mail/components/notifier-page';

type NotifierSearch = { colis?: string; lot?: string };

export const Route = createFileRoute('/_authenticated/notifier')({
  validateSearch: (search: Record<string, unknown>): NotifierSearch => ({
    ...(typeof search.colis === 'string' ? { colis: search.colis } : {}),
    ...(typeof search.lot === 'string' ? { lot: search.lot } : {}),
  }),
  component: NotifierRoute,
});

function NotifierRoute() {
  const { colis, lot } = Route.useSearch();
  return (
    <NotifierPage
      key={`${colis ?? ''}:${lot ?? ''}`}
      parcelId={colis}
      batchId={lot}
    />
  );
}
