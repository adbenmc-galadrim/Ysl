import { createFileRoute } from '@tanstack/react-router';
import { NotifierPage } from '#/features/mail/components/notifier-page';

export const Route = createFileRoute('/_authenticated/notifier')({
  validateSearch: (search: Record<string, unknown>): { colis?: string } =>
    typeof search.colis === 'string' ? { colis: search.colis } : {},
  component: NotifierRoute,
});

function NotifierRoute() {
  const { colis } = Route.useSearch();
  return <NotifierPage key={colis ?? ''} parcelId={colis} />;
}
