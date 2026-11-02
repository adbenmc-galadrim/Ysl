import { createFileRoute } from '@tanstack/react-router';
import { DepartmentPlacePage } from '#/features/department-space/components/department-place-page';

export const Route = createFileRoute('/_authenticated/departement_/lieu')({
  component: DepartmentPlacePage,
});
