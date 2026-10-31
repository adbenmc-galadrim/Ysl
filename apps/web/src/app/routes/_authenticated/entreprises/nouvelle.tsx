import { createFileRoute } from '@tanstack/react-router';
import { NewCompanyPage } from '#/features/platform/new-company-page';

export const Route = createFileRoute('/_authenticated/entreprises/nouvelle')({
  component: NewCompanyPage,
});
