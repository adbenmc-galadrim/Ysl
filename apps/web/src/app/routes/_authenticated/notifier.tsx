import { createFileRoute } from '@tanstack/react-router';
import { NotifierPage } from '#/features/mail/components/notifier-page';

type NotifierSearch = {
  colis?: string;
  lot?: string;
  relance?: boolean;
  prevenir?: boolean;
};

export const Route = createFileRoute('/_authenticated/notifier')({
  validateSearch: (search: Record<string, unknown>): NotifierSearch => ({
    ...(typeof search.colis === 'string' ? { colis: search.colis } : {}),
    ...(typeof search.lot === 'string' ? { lot: search.lot } : {}),
    ...(search.relance === true || search.relance === 'true'
      ? { relance: true }
      : {}),
    ...(search.prevenir === true || search.prevenir === 'true'
      ? { prevenir: true }
      : {}),
  }),
  component: NotifierRoute,
});

function NotifierRoute() {
  const { colis, lot, relance, prevenir } = Route.useSearch();
  return (
    <NotifierPage
      key={`${colis ?? ''}:${lot ?? ''}:${relance ? 'relance' : ''}:${prevenir ? 'prevenir' : ''}`}
      parcelId={colis}
      batchId={lot}
      reminder={relance}
      otherWay={prevenir}
    />
  );
}
