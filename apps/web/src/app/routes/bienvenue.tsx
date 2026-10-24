import { createFileRoute } from '@tanstack/react-router';
import { InstallLanding } from '#/features/install/components/install-landing';
import { redirectIfSignedIn } from '#/features/auth/guards';

export const Route = createFileRoute('/bienvenue')({
  beforeLoad: ({ context }) => redirectIfSignedIn(context.queryClient),
  component: InstallLanding,
});
