import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '#/features/shell/components/role-homes';

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
});
