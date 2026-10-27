import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { DevicesScreen } from '#/features/devices/components/devices-screen';

export const Route = createFileRoute('/_authenticated/reglages/appareils')({
  beforeLoad: ({ context }) => requireAdmin(context),
  component: DevicesScreen,
});
