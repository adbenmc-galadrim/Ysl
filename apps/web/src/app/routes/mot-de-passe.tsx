import { mustChangePassword } from '@repo/contract/auth';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { requireSession } from '#/features/auth/guards';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { ForcedPasswordPage } from '#/features/invitations/components/forced-password-page';

export const Route = createFileRoute('/mot-de-passe')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    });
    if (!mustChangePassword(session)) throw redirect({ to: '/' });
  },
  component: ForcedPasswordPage,
});
