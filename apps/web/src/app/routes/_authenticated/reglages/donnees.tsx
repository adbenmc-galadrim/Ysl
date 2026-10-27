import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { PrivacyScreen } from '#/features/retention/components/privacy-screen';

export const Route = createFileRoute('/_authenticated/reglages/donnees')({
  beforeLoad: ({ context }) => requireAdmin(context),
  component: PrivacyScreen,
});
