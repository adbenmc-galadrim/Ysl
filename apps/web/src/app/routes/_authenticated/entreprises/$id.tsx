import { createFileRoute } from '@tanstack/react-router';
import { CompanyPage } from '#/features/platform/components/company-page';

function Page() {
  const { id } = Route.useParams();
  const { invite } = Route.useSearch();
  return <CompanyPage id={id} invite={invite} />;
}

export const Route = createFileRoute('/_authenticated/entreprises/$id')({
  validateSearch: (search: Record<string, unknown>): { invite?: true } =>
    search.invite === true ? { invite: true } : {},
  component: Page,
});
