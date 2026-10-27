import { createFileRoute } from '@tanstack/react-router';
import { EmailTemplatesPage } from '#/features/mail/components/email-templates-page';

export const Route = createFileRoute('/_authenticated/reglages/modeles-email/')(
  { component: EmailTemplatesPage },
);
