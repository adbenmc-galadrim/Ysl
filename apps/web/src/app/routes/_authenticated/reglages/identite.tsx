import { createFileRoute } from '@tanstack/react-router';
import { IdentityScreen } from '#/features/company/components/identity-screen';

export const Route = createFileRoute('/_authenticated/reglages/identite')({
  component: IdentityScreen,
});
