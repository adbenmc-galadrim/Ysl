import { createFileRoute } from '@tanstack/react-router';
import { JournalPage } from '#/features/platform/components/journal-page';

function Page() {
  const { entreprise } = Route.useSearch();
  return <JournalPage company={entreprise} />;
}

export const Route = createFileRoute('/_authenticated/journal')({
  validateSearch: (search: Record<string, unknown>): { entreprise?: string } =>
    typeof search.entreprise === 'string'
      ? { entreprise: search.entreprise }
      : {},
  component: Page,
});
