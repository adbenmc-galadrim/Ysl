import { createFileRoute } from '@tanstack/react-router';
import { PickupScreen } from '#/features/settings/components/pickup-screen';

export const Route = createFileRoute(
  '/_authenticated/reglages/lieu-et-horaires',
)({
  component: PickupScreen,
});
