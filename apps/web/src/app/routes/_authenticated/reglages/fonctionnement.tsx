import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { OperatingScreen } from '#/features/settings/components/operating-screen';

export const Route = createFileRoute('/_authenticated/reglages/fonctionnement')(
  {
    beforeLoad: ({ context }) => requireAdmin(context),
    component: OperatingScreen,
  },
);
