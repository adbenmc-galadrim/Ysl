import { createFileRoute } from '@tanstack/react-router';
import { OperatingScreen } from '#/features/settings/components/operating-screen';

export const Route = createFileRoute('/_authenticated/reglages/fonctionnement')(
  {
    component: OperatingScreen,
  },
);
