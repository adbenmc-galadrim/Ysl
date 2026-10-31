import { createFileRoute } from '@tanstack/react-router';
import { AccountsScreen } from '#/features/accounts/components/accounts-screen';

export const Route = createFileRoute('/_authenticated/reglages/comptes')({
  component: AccountsScreen,
});
