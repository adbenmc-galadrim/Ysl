import { createFileRoute } from '@tanstack/react-router';
import { DepartmentHistoryPage } from '#/features/department-space/components/department-history-page';

export const Route = createFileRoute('/_authenticated/departement_/historique')({
  component: DepartmentHistoryPage,
});
