import { createFileRoute } from '@tanstack/react-router';
import { SentEmailsPage } from '#/features/mail/components/sent-emails-page';
import { MAIL_FILTERS, type MailFilter } from '#/features/mail/tracking';

type Search = { colis?: string; filtre?: MailFilter };

export const Route = createFileRoute('/_authenticated/reglages/e-mails')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search.colis === 'string' && { colis: search.colis }),
    ...(MAIL_FILTERS.includes(search.filtre as MailFilter) && {
      filtre: search.filtre as MailFilter,
    }),
  }),
  component: SentEmailsRoute,
});

function SentEmailsRoute() {
  const { colis, filtre } = Route.useSearch();
  return (
    <SentEmailsPage
      key={`${colis ?? ''}:${filtre ?? ''}`}
      parcelId={colis}
      initialFilter={filtre}
    />
  );
}
