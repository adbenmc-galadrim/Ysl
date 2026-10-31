import { companyInput } from '@repo/contract/platform';
import { createFileRoute } from '@tanstack/react-router';
import { JournalPage } from '#/features/platform/components/journal-page';

function Page() {
  const { entreprise } = Route.useSearch();
  return <JournalPage companyId={entreprise} />;
}

export const Route = createFileRoute('/_authenticated/journal')({
  validateSearch: (search: Record<string, unknown>): { entreprise?: string } =>
    companyInput.safeParse({ id: search.entreprise }).success
      ? { entreprise: search.entreprise as string }
      : {},
  component: Page,
});
