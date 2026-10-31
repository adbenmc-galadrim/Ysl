import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { SenderScreen } from '#/features/mail/components/sender-screen';

export const Route = createFileRoute('/_authenticated/reglages/expediteur')({
  beforeLoad: ({ context }) => requireAdmin(context),
  component: SenderScreen,
});
