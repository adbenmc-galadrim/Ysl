import { createFileRoute } from '@tanstack/react-router';
import { DevicesScreen } from '#/features/devices/components/devices-screen';

export const Route = createFileRoute('/_authenticated/reglages/appareils')({
  component: DevicesScreen,
});
