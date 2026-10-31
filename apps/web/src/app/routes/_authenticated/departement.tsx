import { createFileRoute } from '@tanstack/react-router';
import { DepartmentHome } from '#/features/shell/components/role-homes';

export const Route = createFileRoute('/_authenticated/departement')({
  component: DepartmentHome,
});
