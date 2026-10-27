import { createFileRoute } from '@tanstack/react-router';
import { MailAppPage } from '#/features/mail/components/mail-app-page';

export const Route = createFileRoute('/_authenticated/reglages/messagerie')({
  component: MailAppPage,
});
