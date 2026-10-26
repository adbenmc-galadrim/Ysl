import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { PickupScreen } from '#/features/settings/components/pickup-screen';

export const Route = createFileRoute(
  '/_authenticated/reglages/lieu-et-horaires',
)({
  beforeLoad: ({ context }) => requireAdmin(context),
  component: PickupScreen,
});
