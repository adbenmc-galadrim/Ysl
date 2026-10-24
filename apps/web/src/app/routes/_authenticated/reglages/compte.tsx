import { createFileRoute } from '@tanstack/react-router';
import { AccountScreen } from '#/features/settings/components/account-screen';

export const Route = createFileRoute('/_authenticated/reglages/compte')({
  component: AccountScreen,
});
