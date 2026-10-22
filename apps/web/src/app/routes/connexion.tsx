import { createFileRoute } from '@tanstack/react-router';
import { SignInScreen } from '#/features/auth/components/sign-in-screen';
import { redirectIfSignedIn } from '#/features/auth/guards';
import { safeRedirect } from '#/features/auth/redirect';

export const Route = createFileRoute('/connexion')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) =>
    redirectIfSignedIn(context.queryClient, search.redirect),
  component: ConnexionPage,
});

function ConnexionPage() {
  const { redirect } = Route.useSearch();
  return <SignInScreen redirectTo={redirect} />;
}
