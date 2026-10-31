import { createFileRoute } from '@tanstack/react-router';
import { DashboardHome } from '#/features/shell/components/role-homes';

export const Route = createFileRoute('/_authenticated/tableau-de-bord')({
  component: DashboardHome,
});
