import { createFileRoute } from '@tanstack/react-router';
import { DepartmentDepositsPage } from '#/features/deposits/components/department-deposits-page';

export const Route = createFileRoute('/_authenticated/departement_/depots/')({
  component: DepartmentDepositsPage,
});
