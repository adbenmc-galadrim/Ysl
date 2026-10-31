import { createFileRoute } from '@tanstack/react-router';
import { CompanyPage } from '#/features/platform/components/company-page';

function Page() {
  const { id } = Route.useParams();
  return <CompanyPage id={id} />;
}

export const Route = createFileRoute('/_authenticated/entreprises/$id')({
  component: Page,
});
