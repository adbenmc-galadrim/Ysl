import { createFileRoute } from '@tanstack/react-router';
import { TourHome } from '#/features/shell/components/role-homes';

export const Route = createFileRoute('/_authenticated/tournee')({
  component: TourHome,
});
